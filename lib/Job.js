var util   = require('util'),
    events = require('events');

/**
 * Represents a job that holds arbitrary data and inherits the EventEmitter interface
 * @param {*[]} data
 * @constructor
 * @private
 */
var Job = function (data) {
    this.data = data;
};

util.inherits(Job, events.EventEmitter);

/**
 * Gets the job data
 * @returns {*[]}
 */
Job.prototype.getData = function () {
    return this.data;
};

module.exports = Job;