'use strict';

/**
 * Represents a thread that has an opened/closed state and a current job property
 * @constructor
 * @private
 */
var Thread = function () {
    this.job = null;
};

/**
 * Returns whether this thread is open for accepting a job
 * @returns {boolean}
 */
Thread.prototype.isOpen = function () {
    return this.job === null;
};

module.exports = Thread;