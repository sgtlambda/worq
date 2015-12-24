'use strict';

class Thread {

    constructor() {
        this.pending = false;
    }

    /**
     * @param {Job} job
     * @returns {Promise}
     */
    run(job) {
        this.pending = true;
        return job.run().then(value => {
            this.pending = false;
            return value;
        });
    }

    /**
     * @returns {boolean}
     */
    isPending() {
        return this.pending;
    }
}

module.exports = Thread;