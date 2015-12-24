'use strict';

require('./support/bootstrap');

const _       = require('lodash');
const Queue   = require('../');
const sinon   = require('sinon');
const Promise = require('bluebird');

const delay = (fn) => Promise.delay(10).then(fn);
const error = () => {
    throw new Error();
};

describe('Queue', () => {

    describe('run', () => {

        let queue;

        beforeEach(() => {
            queue = new Queue({concurrency: 1});
        });

        it('should return a promise for the completion of the jobs', () => {
            let spy1 = sinon.spy();
            return queue.run([
                () => delay(() => spy1())
            ]).then(() => {
                spy1.should.have.been.called;
            });
        });

        it('should run the jobs one by one if the concurrency is set to 1', () => {
            let spy1 = sinon.spy();
            let spy2 = sinon.spy();
            return queue.run([
                () => delay(() => spy1()),
                () => spy2()
            ]).then(() => {
                spy1.should.have.been.calledBefore(spy2);
            });
        });

        it('should fulfill with an array containing the fulfillment values', () => {
            return queue.run([
                () => delay(() => 'foo'),
                () => delay(() => 'bar')
            ]).should.eventually.eql(['foo', 'bar']);
        });

        it('should reject with the error if one is thrown', () => {
            return queue.run([
                () => delay(() => 'foo'),
                () => delay(error)
            ]).should.be.rejected;
        });

        it('should not run the remaining jobs if one of the jobs rejects', () => {
            let spy = sinon.spy();
            return queue.run([
                () => delay(error),
                () => delay(() => spy())
            ]).then(() => {
                throw new Error('Should not fulfill');
            }, () => {
                spy.should.not.have.been.called;
            });
        });

        it('should run the jobs in concurrency', () => {
            queue    = new Queue({concurrency: 3});
            let time = Date.now();
            return queue.run(_.times(9, () => () => Promise.delay(50))).then(() => {
                let passed = Date.now() - time;
                passed.should.be.below(175);
                passed.should.be.above(125);
            });
        });
    });
});