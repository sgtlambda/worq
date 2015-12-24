'use strict';

const Promise = require('bluebird');

class Thread {

    constructor() {
        this.queue = Promise.resolve();
    }

    /**
     * @param {Job} job
     * @returns {Promise}
     */
    enqueue(job) {
        this.queue = this.queue.then(() => job.run());
        return this.queue;
    }

    /**
     * @returns {boolean}
     */
    isPending() {
        return this.queue.isPending();
    }
}

module.exports = Thread;