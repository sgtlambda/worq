'use strict';

require('./support/bootstrap');

const Promise = require('bluebird');
const Job     = require('../lib/Job');
const Thread  = require('../lib/Thread');

describe('Thread', () => {

    var thread = new Thread();

    describe('run()', () => {
        it('should return a promise for the completion of the job', () => {
            return thread.run(new Job(() => Promise.delay(10))).should.be.fulfilled;
        });
    });

    describe('isPending()', () => {
        it('should return true if the job has not fulfilled yet', () => {
            thread.run(new Job(() => Promise.delay(10)));
            thread.isPending().should.be.true;
            return Promise.delay(20).then(() => {
                thread.isPending().should.be.false;
            });
        });
    });
});