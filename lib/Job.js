var events = require('events');

var Job = function (data) {
    this.data = data;
};

Job.prototype.__proto__ = events.EventEmitter.prototype;

Job.prototype.getData = function () {
    return this.data;
};