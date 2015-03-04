/**
 * Represents a thread that has an opened/closed state and a current job property
 * @constructor
 */
var Thread = function () {
    this.job = null;
};

Thread.prototype.isOpen = function () {
    return this.job === null;
};

module.exports = Thread;