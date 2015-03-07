var should = require("should"),
    Worqer = require('../'),
    Q      = require('q');

describe('Worqer', function () {

    var open = false,
        tickLength = 10,
        handle = new Worqer({
            open:        function () {
                return Q.delay(tickLength * 10).then(function () {
                    open = true;
                });
            },
            process:     function (data) {
                if (data === 'bar')
                    return Q('foo').delay(tickLength * 10);
                if (data === 'baz')
                    return Q.delay(tickLength * 10).then(function () {
                        throw new Error('baz is not the word');
                    });
                return Q.delay(tickLength * 10);
            },
            close:       function () {
                return Q.delay(tickLength * 5).then(function () {
                    open = false;
                });
            },
            timeout:     20 * tickLength,
            concurrency: 1
        });

    /**
     * Okay so lets get this straight.
     * Open takes 10 ticks.
     * Processing takes 10 ticks.
     * Closing takes 5 ticks.
     * timeout is set to 20 ticks.
     */

    it('should open whenever a job is added', function (done) {
        handle.process('bar');
        setTimeout(function () {
            open.should.be.true;
            done();
        }, tickLength * 15);
    });

    /**
     * We're now 15 ticks in. It should take another 5 ticks for the first job to complete.
     */

    it('should wait for the active job to finish', function (done) {
        var job2started = false;
        var job = handle.process('bar');
        job.progress(function (val) {
            if (val === Worqer.events.START) {
                job2started = true;
            }
        });

        // At tick 17, let's make sure job has not yet started
        setTimeout(function () {
            job2started.should.be.false;
        }, tickLength * 2);

        // At tick 25, however, it should have
        setTimeout(function () {
            job2started.should.be.true;
            done();
        }, tickLength * 10);
    });

    /**
     * We're at tick 25 now. Job 2 should complete at tick 30. Theoretically the handle will close at tick 50
     */

    it('should stay open as long as the timeout is not exceeded', function (done) {
        // At tick 45, let's see if this badboy is still open
        setTimeout(function () {
            handle.isOpen().should.be.true;
            done();
        }, tickLength * 20);
    });

    /**
     * We're at tick 45. Let's check for return values and errors
     */

    it('should return a promise for the processed values', function (done) {
        var jobResult;
        handle.process('bar').then(function (result) {
            jobResult = result;
        });
        // In 15 ticks, let's check for the return value of job 3
        setTimeout(function () {
            jobResult.should.be.exactly('foo');
            done();
        }, (handle.isOpen() ? tickLength * 10 : 0) + tickLength * 15);
    });

    it('should reject the promise with the error if one is thrown', function (done) {
        var jobError;
        handle.process('baz').then(null, function (error) {
            jobError = error;
        });
        // In 15 ticks, let's check for the error
        setTimeout(function () {
            should.throws(function () {
                throw jobError;
            }, 'baz is not the word');
            done();
        }, tickLength * 15);
    });

    /**
     * The last job has finished 5 ticks ago, so theoretically the handle should start closing in 15 ticks and take
     * 5 ticks to do that
     */

    it('should automatically close when the timeout is exceeded', function (done) {
        setTimeout(function () {
            handle.isClosed().should.be.true;
            open.should.be.false;
            done();
        }, tickLength * 25);
    });

    it('should wait until the queue is empty before closing gracefully', function (done) {
        handle.process('foo');
        handle.process('bar');
        handle.close(true);
        setTimeout(function () {
            handle.isClosed().should.be.true;
            handle.hasJobsPending().should.be.false;
            done();
        }, tickLength * 40);
    });

    it('should reject the jobs in the queue when closing forcefully', function (done) {
        handle.process('foo');
        var jobError;
        handle.process('bar').then(null, function (error) {
            jobError = error;
        });
        handle.close(false);
        setTimeout(function () {
            should.throws(function () {
                throw jobError;
            }, 'The handle was closed forcefully');
            done();
        }, tickLength);
    });

});