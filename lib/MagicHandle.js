var Q           = require('q'),
    _           = require('lodash'),
    events      = require('events'),
    util        = require('util'),
    Thread      = require('./Thread'),
    Job         = require('./Job'),
    functionify = require('functionify');

/**
 * Contains the options for the MagicHandle constructor
 * @typedef {Object} MagicHandleOptions
 * @property {function} open [optional] A function that returns a promise to open the handle
 * @property {function|number} getTimeout [optional] Either a timeout in ms or a function that returns the timeout
 * @property {function} handle [optional] A function that returns a promise for handling the job
 * @property {function} close [optional] A function that returns a promise to close the handle
 * @property {number} concurrency [optional] Indicates how many jobs can be handles concurrently
 */

/**
 * Creates a new magic handle
 * @param {MagicHandleOptions} options
 * @constructor
 */
var MagicHandle = function (options) {
    var o = _.assign({
        open:        function () {
        },
        timeout:     5000,
        process:     function (data) {
            return data;
        },
        close:       function () {
        },
        concurrency: 1
    }, options);

    this._state = MagicHandle.states.CLOSED;
    this._pendingState = null;
    this._queue = [];
    this._threads = _.times(o.concurrency, function () {
        return new Thread();
    });
    this._open = o.open;
    this._getTimeout = functionify(o.timeout);
    this._process = o.process;
    this._close = o.close;
    this._lastActivity = -1;
};

/**
 * State constants for MagicHandle
 * @type {{CLOSED: number, OPENING: number, OPEN: number, CLOSING: number}}
 */
MagicHandle.states = {
    CLOSED:  0,
    OPENING: 1,
    OPEN:    2,
    CLOSING: 3
};

/**
 * State constants for MagicHandle
 * @type {{OPENED: string, CLOSED: string}}
 */
MagicHandle.events = {
    OPENED: 'opened',
    CLOSED: 'closed'
};

util.inherits(MagicHandle, events.EventEmitter);

/**
 * Starts the job in the thread
 * @param {Thread} thread
 */
MagicHandle.prototype._runThread = function (thread) {
    var job = thread.job;
    job.emit('start');
    var jobResult = Q(this._process(job.getData()));
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
 * Processes the job queue
 */
MagicHandle.prototype._processQueue = function () {
    if (this.hasJobsPending()) {
        this._safeOpen().then(function () {
            var thread;
            while ((thread = this._getOpenThread()) !== undefined && this.hasJobsPending()) {
                thread.job = this._queue.shift();
                this._runThread(thread);
            }
        }.bind(this)).done();
    }
};

/**
 * Processes the pending state
 */
MagicHandle.prototype._processState = function () {

    if (
        this._pendingState === MagicHandle.states.OPEN &&
        this._state === MagicHandle.states.CLOSED
    ) {
        this._state = MagicHandle.states.OPENING;
        Q(this._open()).then(function () {
            Q.delay(this._getTimeout()).then(this._considerClose.bind(this)).done();
            this.emit(MagicHandle.events.OPENED);
            this._state = MagicHandle.states.OPEN;
            this._processState();
        }.bind(this)).done();
    }

    if (
        this._pendingState === MagicHandle.states.CLOSED &&
        this._state === MagicHandle.states.OPEN
    ) {
        this._state = MagicHandle.states.CLOSING;
        Q(this._close()).then(function () {
            this.emit(MagicHandle.events.CLOSED);
            this._state = MagicHandle.states.CLOSED;
            this._processState();
        }.bind(this)).done();
    }

};

/**
 * Checks whether there has not been any activity in the past {timeout} ms and there are no active threads; then
 * closes if appropriate
 * @returns {Q.Promise}
 */
MagicHandle.prototype._considerClose = function () {
    var timeout = this._getTimeout();
    var current = Date.now();
    var closeAt = this.hasActiveThreads() ? current + timeout : this._lastActivity + timeout;
    if (current > closeAt)
        return this._safeClose();
    else
        return Q.delay(closeAt - current).then(this._considerClose.bind(this));
};

/**
 * Gets the first open thread in the thread stack, or if there are no open threads, returns undefined
 * @returns {Thread|undefined}
 */
MagicHandle.prototype._getOpenThread = function () {
    return _.find(this._threads, function (thread) {
        return thread.isOpen();
    });
};

/**
 * Safe function for requesting the handle to open. Returns a promise for opening the handle.
 * @returns {Promise}
 */
MagicHandle.prototype._safeOpen = function () {
    return this.isOpen() ? Q() : Q.Promise(function (resolve) {
        this._pendingState = MagicHandle.states.OPEN;
        this._processState();
        this.once(MagicHandle.events.OPENED, function () {
            resolve();
        });
    }.bind(this));
};

/**
 * Safe function for requesting the handle to close. Returns a promise for closing the handle.
 * @returns {Promise}
 */
MagicHandle.prototype._safeClose = function () {
    return this.isClosed() ? Q() : Q.Promise(function (resolve) {
        this._pendingState = MagicHandle.states.CLOSED;
        this._processState();
        this.once(MagicHandle.events.CLOSED, function () {
            resolve();
        });
    }.bind(this));
};

/**
 * Adds a job holding the given data to the job queue
 * @param {Object} data
 * @return {Promise<Object>}
 */
MagicHandle.prototype.process = function (data) {
    var deferred = Q.defer();
    var job = new Job(data);
    this._queue.push(job);
    this._processQueue();
    job.once('start', function () {
        deferred.notify('start');
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
 * Determines whether any of the threads has an active running job
 * @returns {boolean}
 */
MagicHandle.prototype.hasActiveThreads = function () {
    return _.some(this._threads, function (thread) {
        return thread.job !== null;
    });
};

/**
 * Returns whether there are jobs waiting to be handled in the queue
 * @returns {boolean}
 */
MagicHandle.prototype.hasJobsPending = function () {
    return !!this._queue.length;
};

/**
 * Returns whether the handle is currently open
 * @returns {boolean}
 */
MagicHandle.prototype.isOpen = function () {
    return this._state === MagicHandle.states.OPEN;
};

/**
 * Returns whether the handle is currently closed
 * @returns {boolean}
 */
MagicHandle.prototype.isClosed = function () {
    return this._state === MagicHandle.states.CLOSED;
};

module.exports = MagicHandle;