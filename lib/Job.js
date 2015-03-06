var util   = require('util'),
    events = require('events');

var Job = function (data) {
    this.data = data;
};

util.inherits(Job, events.EventEmitter);

Job.prototype.getData = function () {
    return this.data;
};

module.exports = Job;