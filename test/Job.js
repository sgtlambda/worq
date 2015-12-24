'use strict';

require('./support/bootstrap');

const Job = require('../lib/Job');

describe('Job', function () {

    it('should emit fulfilled if the promise is fulfilled', function () {
        let job = new Job(() => Promise.resolve());
        return new Promise((fulfill, reject) => {
            setTimeout(reject, 1000);
            job.on('fulfilled', fulfill());
            job.run();
        });
    });

    it('should emit rejected if the promise is fulfilled', function () {
        let job = new Job(() => Promise.reject());
        return new Promise((fulfill, reject) => {
            setTimeout(reject, 1000);
            job.on('rejected', fulfill());
            job.run();
        });
    });

    it('should emit fulfilled if a regular function does not throw any errors', function () {
        let job = new Job(() => true);
        return new Promise((fulfill, reject) => {
            setTimeout(reject, 1000);
            job.on('fulfilled', fulfill());
            job.run();
        });
    });

    it('should emit rejected if a regular function throws a error', function () {
        let job = new Job(() => {
            throw new Error();
        });
        return new Promise((fulfill, reject) => {
            setTimeout(reject, 1000);
            job.on('rejected', fulfill());
            job.run();
        });
    });
});