'use strict';

var _           = require('lodash'),
    util        = require('util'),
    Promise     = require('bluebird'),
    events      = require('events'),
    functionify = require('functionify'),

    Thread      = require('./Thread'),
    Job         = require('./Job'),
    pending     = require('./PendingPromise');

/**
 * Contains the options for the Worqer constructor
 * @typedef {Object} WorqerOptions
 * @property {function|number} [timeout=5000] Either a timeout in ms or a function that returns the timeout
 * @property {number} [concurrency=1] Indicates how many threads are instantiated
 * @property {WorqerStateOperator} [open] Function that opens the Worqer
 * @property {WorqerStateOperator} [close] Function that closes the Worqer
 */

/**
 * Function that handles jobs in a Worqer
 * @typedef {function} WorqerProcessor
 * @param {*} data The input data assigned to the job
 * @param {number} threadNo The number of the thread the job was assigned to
 * @return {Promise<*>|*} The output data
 */

/**
 * Function that opens or closes a Worqer
 * @typedef {function} WorqerStateOperator
 * @return {Promise|void} If a promise is returned, the Worqer will wait until the promise is resolved
 */

/**
 * Creates a new Worqer
 * @param {WorqerProcessor} [processor] Function that handles the jobs passed to this Worqer. If not provided, any
 *     value, function or promise can be passed to this Worqer.
 * @param {WorqerOptions} [options] Options for the Worqer
 * @constructor
 */
var Worqer = function (processor, options) {

    if (!_.isFunction(processor) && _.isUndefined(options)) {
        processor = undefined;
        options = processor;
    }

    var o = _.assign({
        timeout:      0,
        concurrency:  1,
        passThreadNo: false
    }, options);

    this._state = Worqer.states.CLOSED;
    this._pendingState = null;
    this._queue = [];

    this._threads = _.times(o.concurrency, function () {
        return new Thread();
    });

    this._fn = {
        process: typeof processor !== typeof undefined ? processor : function (obj) {
            return functionify(obj)();
        },
        open:    functionify(o.open),
        close:   functionify(o.close)
    };

    this._passThreadNo = o.passThreadNo;
    this._getTimeout = functionify(o.timeout);
    this._pendingClose = null;
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
 * @return {Worqer} <code>this</code> The instance on which the method was called, for chaining purposes
 * @private
 */
Worqer.prototype._runThread = function (thread) {
    var job = thread.job;
    job.emit(Worqer.events.START);
    var threadNo = _.indexOf(this._threads, thread);
    var args = job.getData().concat(this._passThreadNo ? [threadNo] : []);
    var jobResult = Promise.resolve(this._fn.process.apply(this, args));
    jobResult.then(function (result) {
        job.emit('result', result);
    }).catch(function (err) {
        job.emit('error', err);
    }).done(function () {
        thread.job = null;
        this._processQueue();
        this._setPendingClose();
    }.bind(this));
    return this;
};

/**
 * Processes the job queue. This method is invoked every time a job finishes running and when a new job is added
 * @return {Worqer} <code>this</code> The instance on which the method was called, for chaining purposes
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
    return this;
};

/**
 * Sets a new pending promise for the Worqer to close after the specified timeout
 * @return {Worqer} <code>this</code> The instance on which the method was called, for chaining purposes
 * @private
 */
Worqer.prototype._setPendingClose = function () {
    this._cancelPendingClose();
    this._pendingClose = pending(this._getTimeout(), true);
    this._pendingClose.then(function () {
        if (!this.hasActiveThreads()) {
            this._safeClose();
        }
    }.bind(this)).catch(function (reason) {
        // The pending close was cancelled
    }).done();
    return this;
};

/**
 * If there is still a close pending, cancels it
 * @return {Worqer} <code>this</code> The instance on which the method was called, for chaining purposes
 * @private
 */
Worqer.prototype._cancelPendingClose = function () {
    if (this._pendingClose !== null) {
        this._pendingClose.cancel(false);
        this._pendingClose = null;
    }
    return this;
};

/**
 * Facilitates a transition from one state to another, if applicable
 * @param {number} fromState The state to transition from
 * @param {number} transitioningState The state the Worqer will be set to while transitioning
 * @param {number} toState The state to transition to
 * @param {function} func The function that will change the state
 * @param {string} transitionedEvent The event that will be fired once transitioned
 * @param {function} [callback] A function to call once transitioned
 * @returns {Worqer} <code>this</code> The instance on which the method was called, for chaining purposes
 * @private
 */
Worqer.prototype._transitionState = function (fromState, transitioningState, toState, func, transitionedEvent, callback) {
    if (this._pendingState === toState && this._state === fromState) {
        this._state = transitioningState;
        Promise.resolve(func()).then(function () {
            this._state = toState;
            functionify(callback)();
            this.emit(transitionedEvent);
            this._processPendingState();
        }.bind(this)).done();
    }
    return this;
};

/**
 * Processes the pending state, if applicable
 * @return {Worqer} <code>this</code> The instance on which the method was called, for chaining purposes
 * @private
 */
Worqer.prototype._processPendingState = function () {
    this._transitionState(
        Worqer.states.CLOSED, Worqer.states.OPENING, Worqer.states.OPEN, this._fn.open, Worqer.events.OPENED,
        function () {
            this._setPendingClose();
        }.bind(this));
    this._transitionState(
        Worqer.states.OPEN, Worqer.states.CLOSING, Worqer.states.CLOSED, this._fn.close, Worqer.events.CLOSED);
    return this;
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
 * @param {number} state The target state
 * @param {number} pendingState The state once the open/close action has begun
 * @param {string} event The event that fires once the state has changed
 * @returns {Promise}
 * @private
 */
Worqer.prototype._safeChangeState = function (state, pendingState, event) {
    if (this._state === state)
        return Promise.resolve();
    if (this._state === pendingState)
        return new Promise(function (resolve) {
            this.once(event, resolve);
        }.bind(this));
    else
        return new Promise(function (resolve) {
            this._pendingState = state;
            this._processPendingState()
                .once(event, resolve);
        }.bind(this));
};

/**
 * Safe function for requesting the handle to open. Returns a promise for opening the handle.
 * @returns {Promise}
 * @private
 */
Worqer.prototype._safeOpen = function () {
    return this._safeChangeState(Worqer.states.OPEN, Worqer.states.OPENING, Worqer.events.OPENED);
};

/**
 * Safe function for requesting the handle to close. Returns a promise for closing the handle.
 * @returns {Promise}
 * @private
 */
Worqer.prototype._safeClose = function () {
    this._cancelPendingClose();
    return this._safeChangeState(Worqer.states.CLOSED, Worqer.states.CLOSING, Worqer.events.CLOSED);
};

/**
 * Adds the given data to the job queue, returns a promise for the output data.
 * Any arguments passed to this function will be passed to the Worqer's process function in the same order.
 * @return {Promise<*>} A promise for the data returned by this Worqer's process function
 */
Worqer.prototype.process = function () {
    var args = [].splice.call(arguments, 0);
    return new Promise(function (resolve, reject) {
        var job = new Job(args);
        this._queue.push(job);
        this._processQueue();
        job.once('result', function (result) {
            resolve(result);
        }).once('error', function (err) {
            reject(err);
        });
    }.bind(this));
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
 * Requests for the handle to close
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
        return new Promise(function (resolve) {
            this.once(Worqer.events.IDLE, function () {
                resolve(this._safeClose());
            }.bind(this));
        }.bind(this));
    } else {
        return this._safeClose();
    }
};

module.exports = Worqer;