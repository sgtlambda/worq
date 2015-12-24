'use strict';

const Promise      = require('pinkie-promise');
const EventEmitter = require('events').EventEmitter;

class Job extends EventEmitter {

    constructor(fn) {
        super();
        this.fn = fn;
    }

    run() {
        return Promise.resolve(this.fn()).then(result => this.emit('fulfilled', result), error => this.emit('rejected', error));
    }
}

module.exports = Job;