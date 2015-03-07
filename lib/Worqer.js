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
 * Creates a new Worqer
 * @param {function} [open=null] Optional function that opens the Worqer or returns a promise for doing so
 * @param {function} process Function that takes the input data as the first argument and the thread number as the
 *     second and returns (a promise for) the output data
 * @param {function} [close=null] Optional function that closes the Worqer or returns a promise for doing so
 * @param {WorqerOptions} [options]
 * @constructor
 */
var Worqer = function (open, process, close, options) {
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
    this._process = process;
    this._open = functionify(open);
    this._close = functionify(close);

    this._monitorStateInterval = o.monitorStateInterval;
    this._getTimeout = functionify(o.timeout);
    this._lastActivity = -1;
};

/**
 * State constants for Worqer
 * @type {{CLOSED: number, OPENING: number, OPEN: number, CLOSING: number}}
 */
Worqer.states = {
    CLOSED:  0,
    OPENING: 1,
    OPEN:    2,
    CLOSING: 3
};

/**
 * State constants for Worqer
 * @type {{OPENED: string, CLOSED: string}}
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
 */
Worqer.prototype._runThread = function (thread) {
    var job = thread.job;
    job.emit(Worqer.events.START);
    var threadNo = _.indexOf(this._threads, thread);
    var jobResult = Q(this._process(job.getData(), threadNo));
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
 */
Worqer.prototype._processState = function () {

    if (
        this._pendingState === Worqer.states.OPEN &&
        this._state === Worqer.states.CLOSED
    ) {
        this._state = Worqer.states.OPENING;
        Q(this._open()).then(function () {
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
        Q(this._close()).then(function () {
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
 */
Worqer.prototype._considerClose = function () {
    if (this.isClosed() || this._state === Worqer.states.CLOSING)
        return Q();
    var timeout = this._getTimeout();
    var current = Date.now();
    var closeAt = this.hasActiveThreads() ? current + timeout : this._lastActivity + timeout;
    if (current > closeAt)
        return this._safeClose();
    else
        return Q.delay(this._monitorStateInterval).then(this._considerClose.bind(this));

    // TODO find a way to interrupt the scheduled _considerClose call instead of just calling it over and over
};

/**
 * Gets the first open thread in the thread stack, or if there are no open threads, returns undefined
 * @returns {Thread|undefined}
 */
Worqer.prototype._getOpenThread = function () {
    return _.find(this._threads, function (thread) {
        return thread.isOpen();
    });
};

/**
 * Safe function for requesting the handle to open. Returns a promise for opening the handle.
 * @returns {Promise}
 */
Worqer.prototype._safeOpen = function () {
    return this.isOpen() ? Q() : Q.Promise(function (resolve) {
        this._pendingState = Worqer.states.OPEN;
        this._processState();
        this.once(Worqer.events.OPENED, function () {
            resolve();
        });
    }.bind(this));
};

/**
 * Safe function for requesting the handle to close. Returns a promise for closing the handle.
 * @returns {Promise}
 */
Worqer.prototype._safeClose = function () {
    return this.isClosed() ? Q() : Q.Promise(function (resolve) {
        this._pendingState = Worqer.states.CLOSED;
        this._processState();
        this.once(Worqer.events.CLOSED, function () {
            resolve();
        });
    }.bind(this));
};

/**
 * Adds the given input data to the job queue, returns a promise for the output data
 * @param {Object} data
 * @return {Promise<Object>}
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
    if (typeof graceful === typeof undefined)
        graceful = true;
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
    } else
        return this._safeClose();
};

module.exports = Worqer;