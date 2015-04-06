'use strict';

require('./support/bootstrap');

var Worqer      = require('../'),
    functionify = require('functionify'),
    sinon       = require('sinon'),
    Q           = require('q');

describe('Worqer', function () {

    var handle;

    var finishedJobSpy;
    var openedSpy;
    var closedSpy;

    var tickLength = 1;

    this.beforeEach(function () {

        openedSpy = sinon.spy();
        closedSpy = sinon.spy();
        finishedJobSpy = sinon.spy();

        handle = new Worqer(function (threadNo, data) {
            return Q.delay(tickLength * 10).then(function () {
                return functionify(data)();
            });
        }, {
            open:        function () {
                return Q.delay(tickLength * 10).then(openedSpy);
            },
            close:       function () {
                return Q.delay(tickLength * 5).then(closedSpy);
            },
            timeout:     20 * tickLength,
            concurrency: 1
        });

        sinon.spy(handle._fn, 'open');
        sinon.spy(handle._fn, 'close');
        sinon.spy(handle._fn, 'process');

    });

    it('should open whenever a job is added', function () {

        handle.process('bar');

        return Q.delay(tickLength * 5).then(function () {
            return handle._fn.open.should.have.been.called;
        });

    });

    it('should wait for the handle to open before starting the job', function () {

        handle.process('bar');
        handle.process('foobar');

        Q.delay(tickLength * 5).then(function () {
            return handle._fn.process.should.not.have.been.called;
        });

        return Q.delay(tickLength * 15).then(function () {
            openedSpy.should.have.been.calledBefore(handle._fn.process);
        });

    });

    it('should wait for the active job to finish', function () {

        var jobSpy = sinon.spy();

        handle.process(jobSpy);
        handle.process('bar');

        return Q.delay(tickLength * 25).then(function () {
            return jobSpy.should.have.been.calledBefore(handle._fn.process.withArgs('bar'));
        });

    });

    it('should stay open as long as the timeout is not exceeded', function () {

        handle.process('bar');

        return Q.delay(tickLength * 30).then(function () {
            return handle._fn.close.should.not.have.been.called;
        });

    });

    it('should return a promise for the processed values', function () {

        return handle.process('bar').should.eventually.equal('bar');

    });

    it('should reject the promise with the error if one is thrown', function () {

        var throwsError = sinon.stub().throws(new Error('baz is not the word'));
        return handle.process(throwsError).should.be.rejectedWith('baz is not the word');

    });

    it('should automatically close when the timeout is exceeded', function () {

        handle.process('bar');

        return Q.delay(tickLength * 45).then(function () {
            return handle._fn.close.should.have.been.called;
        });

    });

    it('should wait until the queue is empty before closing gracefully', function () {

        var jobSpy = sinon.spy();

        handle.process('bar');
        handle.process('foobar').then(jobSpy);
        handle.close(true);

        return Q.delay(tickLength * 40).then(function () {
            jobSpy.should.have.been.calledBefore(handle._fn.close);
        });

    });

    it('should reject the jobs in the queue when closing forcefully', function () {

        handle.process('foo');
        var job2 = handle.process('foobar');

        setTimeout(function () {
            handle.close(false);
        }, tickLength * 15);

        return job2.should.be.rejectedWith('The handle was closed forcefully');

    });

    it('should provide a default processor function in case none is defined', function () {

        var defaultHandler = new Worqer();
        return defaultHandler.process('foobar').should.eventually.equal('foobar');

    });

});