var Q           = require('q'),
    _           = require('lodash'),
    events      = require('events'),
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
            return Q();
        },
        timeout:     function () {
            return 10 * 1000;
        },
        handle:      function (job) {
            return Q(job);
        },
        close:       function () {
            return Q();
        },
        concurrency: 1
    }, options);

    this.state = MagicHandle.states.CLOSED;
    this.pendingState = null;
    this.queue = [];
    this.threads = [];
    for (var i = 0; i < o.concurrency; i++)
        this.threads.push(new Thread());

    this.open = o.open;
    this.getTimeout = functionify(o.timeout);
    this.handle = o.handle;
    this.close = o.close;
    this.lastActivity = -1;
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

MagicHandle.prototype = (function () {

    /**
     * Starts the job in the thread
     * @param {Thread} thread
     */
    var runThread = function (thread) {
        var job = thread.job;
        this.handle(job)
            .then(function (result) {
                job.emit('result', result);
            }).catch(function (err) {
                job.emit('error', err);
            }).done(function () {
                this.lastActivity = Date.now();
                thread.job = null;
                processQueue();
            }.bind(this));
    };

    /**
     * Processes the job queue
     */
    var processQueue = function () {
        if (this.hasJobsPending()) {
            safeOpen().then(function () {
                var thread;
                while ((thread = getOpenThread()) !== undefined && this.hasJobsPending()) {
                    thread.job = this.queue.shift();
                    runThread(thread);
                }
            }.bind(this));
        }
    };

    /**
     * Processes the pending state
     */
    var processState = function () {

        if (
            this.pendingState === MagicHandle.states.OPEN &&
            this.state === MagicHandle.states.CLOSED
        ) {
            this.state = MagicHandle.states.OPENING;
            this.open().then(function () {
                this.emit(MagicHandle.events.OPENED);
                this.state = MagicHandle.states.OPEN;
                processState();
            }.bind(this));
            Q.delay(this.getTimeout()).then(considerClose.bind(this));
        }

        if (
            this.pendingState === MagicHandle.states.CLOSED &&
            this.state === MagicHandle.states.OPEN
        ) {
            this.state = MagicHandle.states.CLOSING;
            this.close().then(function () {
                this.emit(MagicHandle.events.CLOSED);
                this.state = MagicHandle.states.CLOSED;
                processState();
            }.bind(this));
        }

    };

    /**
     * Checks whether there has not been any activity in the past {timeout} ms and there are no active threads; then
     * closes if appropriate
     * @returns {Q.Promise}
     */
    var considerClose = function () {
        var timeout = this.getTimeout();
        var current = Date.now();
        var closeAt = this.hasActiveThreads() ? current + timeout : this.lastActivity + timeout;
        if (current > closeAt)
            return safeClose();
        else
            return Q.delay(closeAt - current).then(considerClose.bind(this));
    };

    /**
     * Gets the first open thread in the thread stack, or if there are no open threads, returns undefined
     * @returns {Thread|undefined}
     */
    var getOpenThread = function () {
        return _.find(this.threads, function (thread) {
            return thread.isOpen();
        });
    };

    /**
     * Safe function for requesting the handle to open. Returns a promise for opening the handle.
     * @returns {Q.Promise}
     */
    var safeOpen = function () {
        return this.isOpen ? Q() : Q.Promise(function (resolve) {
            this.pendingState = MagicHandle.states.OPEN;
            processState();
            this.once(MagicHandle.events.OPENED, function () {
                resolve();
            });
        }.bind(this));
    };

    /**
     * Safe function for requesting the handle to close. Returns a promise for closing the handle.
     * @returns {Q.Promise}
     */
    var safeClose = function () {
        return this.isClosed() ? Q() : Q.Promise(function (resolve) {
            this.pendingState = MagicHandle.states.CLOSED;
            processState();
            this.once(MagicHandle.events.CLOSED, function () {
                resolve();
            });
        }.bind(this));
    };

    return {
        __proto__: events.EventEmitter.prototype,
        /**
         * Adds the job to the job queue
         * @param {Object} job
         * @return {Promise<Job>}
         */
        queue:     function (job) {
            var deferred = Q.defer();
            this.queue.push(job);
            processQueue();
            job.once('result', function (result) {
                deferred.resolve(result);
            });
            job.once('error', function (err) {
                deferred.reject(err);
            });
            return deferred.promise;
        },

        /**
         * Determines whether any of the threads has an active running job
         * @returns {boolean}
         */
        hasActiveThreads: function () {
            return _.some(this.threads, function (thread) {
                return thread.job !== null;
            });
        },

        /**
         * Returns whether there are jobs waiting to be handled in the queue
         * @returns {boolean}
         */
        hasJobsPending: function () {
            return !!this.queue.length;
        },

        /**
         * Returns whether the handle is currently open
         * @returns {boolean}
         */
        isOpen: function () {
            return this.state === MagicHandle.states.OPEN;
        },

        /**
         * Returns whether the handle is currently closed
         * @returns {boolean}
         */
        isClosed: function () {
            return this.state === MagicHandle.states.CLOSED;
        }
    };

})();

module.exports = MagicHandle;