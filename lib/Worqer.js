var Q           = require('q'),
    _           = require('lodash'),
    events      = require('events'),
    util        = require('util'),
    Thread      = require('./Thread'),
    Job         = require('./Job'),
    functionify = require('functionify');

/**
 * Contains the options for the Worqer constructor
 * @typedef {Object} WorqerOptions
 * @property {function|number} [timeout=5000] Either a timeout in ms or a function that returns the timeout
 * @property {number} [concurrency=1] Indicates how many threads are instantiated
 */

/**
 * Function that handles jobs in a Worqer
 * @typedef {function} WorqerProcessor
 * @param {*} data The input data assigned to the job
 * @param {number} threadNo The number of the thread the job was assigned to
 * @return {*} The output data
 */

/**
 * Creates a new Worqer
 * @param {function|null} [open=null] Optional function that opens or promises to open the Worqer
 * @param {WorqerProcessor} processor Function that handles the jobs passed to this Worqer
 * @param {function|null} [close=null] Optional function that closes or promises to close the Worqer
 * @param {WorqerOptions} [options] Options for the Worqer
 * @constructor
 */
var Worqer = function (open, processor, close, options) {
    var o = _.assign({
        timeout:              5000,
        concurrency:          1,
        monitorStateInterval: 25
    }, options);

    this._state = Worqer.states.CLOSED;
    this._pendingState = null;
    this._queue = [];

    this._threads = _.times(o.concurrency, function () {
        return new Thread();
    });
    this._fn = {
        process: processor,
        open:    functionify(open),
        close:   functionify(close)
    };

    this._monitorStateInterval = o.monitorStateInterval;
    this._getTimeout = functionify(o.timeout);
    this._lastActivity = -1;
};

/**
 * State constants for Worqer
 * @private
 */
Worqer.states = {
    CLOSED:  0,
    OPENING: 1,
    OPEN:    2,
    CLOSING: 3
};

/**
 * State constants for Worqer
 * @private
 */
Worqer.events = {
    OPENED: 'opened',
    CLOSED: 'closed',
    IDLE:   'idle',
    START:  'start'
};

util.inherits(Worqer, events.EventEmitter);

/**
 * Starts the job in the thread
 * @param {Thread} thread
 * @private
 */
Worqer.prototype._runThread = function (thread) {
    var job = thread.job;
    job.emit(Worqer.events.START);
    var threadNo = _.indexOf(this._threads, thread);
    var jobResult = Q(this._fn.process(job.getData(), threadNo));
    jobResult.then(function (result) {
        job.emit('result', result);
    }).catch(function (err) {
        job.emit('error', err);
    }).done(function () {
        this._lastActivity = Date.now();
        thread.job = null;
        this._processQueue();
    }.bind(this));
};

/**
 * Processes the job queue. This method is invoked every time a job finishes running and when a new job is added
 * @private
 */
Worqer.prototype._processQueue = function () {
    if (this.hasJobsPending()) {
        this._safeOpen().then(function () {
            var thread;
            while ((thread = this._getOpenThread()) !== undefined && this.hasJobsPending()) {
                thread.job = this._queue.shift();
                this._runThread(thread);
            }
        }.bind(this)).done();
    } else if (!this.hasActiveThreads()) {
        this.emit(Worqer.events.IDLE);
    }
};

/**
 * Processes the pending state
 * @private
 */
Worqer.prototype._processState = function () {

    if (
        this._pendingState === Worqer.states.OPEN &&
        this._state === Worqer.states.CLOSED
    ) {
        this._state = Worqer.states.OPENING;
        Q(this._fn.open()).then(function () {
            Q.delay(this._monitorStateInterval).then(this._considerClose.bind(this)).done();
            this.emit(Worqer.events.OPENED);
            this._state = Worqer.states.OPEN;
            this._processState();
        }.bind(this)).done();
    }

    if (
        this._pendingState === Worqer.states.CLOSED &&
        this._state === Worqer.states.OPEN
    ) {
        this._state = Worqer.states.CLOSING;
        Q(this._fn.close()).then(function () {
            this.emit(Worqer.events.CLOSED);
            this._state = Worqer.states.CLOSED;
            this._processState();
        }.bind(this)).done();
    }

};

/**
 * Checks whether there has not been any activity in the past {timeout} ms and there are no active threads; then
 * closes if appropriate
 * @returns {Promise}
 * @private
 */
Worqer.prototype._considerClose = function () {
    if (this.isClosed() || this._state === Worqer.states.CLOSING) {
        return Q();
    }
    var timeout = this._getTimeout();
    var current = Date.now();
    var closeAt = this.hasActiveThreads() ? current + timeout : this._lastActivity + timeout;
    if (current > closeAt) {
        return this._safeClose();
    } else {
        return Q.delay(this._monitorStateInterval).then(this._considerClose.bind(this));
    }

    // TODO use proprietary implementation of Promise::delay that returns the timeout id so that it can be cleared
};

/**
 * Gets the first open thread in the thread stack, or if there are no open threads, returns undefined
 * @returns {Thread|undefined}
 * @private
 */
Worqer.prototype._getOpenThread = function () {
    return _.find(this._threads, function (thread) {
        return thread.isOpen();
    });
};

/**
 * Promises to change the state.
 * @param {string} pendingState The value to set the pendingState to
 * @param {string} event The event that fires once the state has changed
 * @returns {Promise}
 * @private
 */
Worqer.prototype._safeChangeState = function (pendingState, event) {
    return this._state === pendingState ? Q() : Q.Promise(function (resolve) {
        this._pendingState = pendingState;
        this._processState();
        this.once(event, resolve);
    }.bind(this));
};

/**
 * Safe function for requesting the handle to open. Returns a promise for opening the handle.
 * @returns {Promise}
 * @private
 */
Worqer.prototype._safeOpen = function () {
    return this._safeChangeState(Worqer.states.OPEN, Worqer.events.OPENED);
};

/**
 * Safe function for requesting the handle to close. Returns a promise for closing the handle.
 * @returns {Promise}
 * @private
 */
Worqer.prototype._safeClose = function () {
    return this._safeChangeState(Worqer.states.CLOSED, Worqer.events.CLOSED);
};

/**
 * Adds the given data to the job queue, returns a promise for the output data
 * @param {*} data The data that is passed to this Worqer's process function
 * @return {Promise<*>} A promise for the data returned by this Worqer's process function
 */
Worqer.prototype.process = function (data) {
    var deferred = Q.defer();
    var job = new Job(data);
    this._queue.push(job);
    this._processQueue();
    job.once(Worqer.events.START, function () {
        deferred.notify(Worqer.events.START);
    });
    job.once('result', function (result) {
        deferred.resolve(result);
    });
    job.once('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
};

/**
 * Determines whether any of the threads is running a job
 * @returns {boolean}
 */
Worqer.prototype.hasActiveThreads = function () {
    return _.some(this._threads, function (thread) {
        return thread.job !== null;
    });
};

/**
 * Returns whether there are jobs waiting to be handled in the queue
 * @returns {boolean}
 */
Worqer.prototype.hasJobsPending = function () {
    return !!this._queue.length;
};

/**
 * Returns whether the handle is currently open
 * @returns {boolean}
 */
Worqer.prototype.isOpen = function () {
    return this._state === Worqer.states.OPEN;
};

/**
 * Returns whether the handle is currently closed
 * @returns {boolean}
 */
Worqer.prototype.isClosed = function () {
    return this._state === Worqer.states.CLOSED;
};

/**
 * @param {boolean} [graceful = true] Whether to let jobs in the job queue run first. If not, only lets
 *     currently running jobs finish and rejects any other jobs in the the job queue.
 * @returns {Promise}
 */
Worqer.prototype.close = function (graceful) {
    graceful = typeof graceful === typeof true ? graceful : true;
    if (!graceful) {
        _.each(this._queue, function (job) {
            job.emit('error', new Error('The handle was closed forcefully'));
        });
        this._queue = [];
    }
    if (this.hasActiveThreads() || this.hasJobsPending()) {
        var defered = Q.defer();
        this.once(Worqer.events.IDLE, function () {
            defered.resolve(this._safeClose());
        }.bind(this));
        return defered.promise;
    } else {
        return this._safeClose();
    }
};

module.exports = Worqer;