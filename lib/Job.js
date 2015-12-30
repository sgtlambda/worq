'use strict';

const Promise      = require('pinkie-promise');
const EventEmitter = require('events').EventEmitter;

class Job extends EventEmitter {

    constructor(fn) {
        super();
        this.fn = fn;
    }

    run() {
        try {
            let result = this.fn();
            return Promise.resolve(result).then(
                result => this.emit('fulfilled', result),
                error => this.emit('rejected', error)
            );
        } catch (error) {
            this.emit('rejected', error);
        }
    }
}

module.exports = Job;