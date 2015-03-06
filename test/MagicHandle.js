var should      = require("should"),
    MagicHandle = require('../'),
    Q           = require('q');

describe('MagicHandle', function () {

    var open = false;
    var job;
    var job2;
    var job2started = false;
    var job3result;
    var job4error;
    var tickLength = 5;

    var handle = new MagicHandle({
        open:    function () {
            return Q.delay(tickLength * 10).then(function () {
                open = true;
            });
        },
        process: function (data) {
            if (data === 'bar')
                return Q('foo').delay(tickLength * 10);
            if (data === 'baz')
                return Q.delay(tickLength * 10).then(function () {
                    throw new Error('baz is not the word');
                });
            return Q.delay(tickLength * 10);
        },
        close:   function () {
            return Q.delay(tickLength * 5).then(function () {
                open = false;
            });
        },
        timeout: 20 * tickLength
    });

    /**
     * Okay so lets get this straight.
     * Open takes 10 ticks.
     * Processing takes 10 ticks.
     * Closing takes 5 ticks.
     * timeout is set to 20 ticks.
     */

    it('should open whenever a job is added', function (done) {
        job = handle.process('bar');
        setTimeout(function () {
            open.should.be.true;
            done();
        }, tickLength * 15);
    });

    /**
     * We're now 15 ticks in. It should take another 5 ticks for the first job to complete.
     */

    it('should wait for the last job to finish before starting a new one', function (done) {
        job2 = handle.process('bar');
        job2.progress(function (val) {
            if (val === 'start') {
                job2started = true;
            }
        });

        // At tick 17, let's make sure job2 has not yet started
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
        handle.process('bar').then(function (result) {
            job3result = result;
        });
        // In 15 ticks, let's check for the return value of job 3
        setTimeout(function () {
            job3result.should.be.exactly('foo');
            done();
        }, (handle.isOpen() ? tickLength * 10 : 0) + tickLength * 15);
    });

    it('should reject the promise with the error if one is thrown', function (done) {
        handle.process('baz').then(null, function (error) {
            job4error = error;
        });
        // In 15 ticks, let's check for the error
        setTimeout(function () {
            should.throws(function () {
                throw job4error;
            }, 'baz is not the word');
            done();
        }, tickLength * 15);
    });

    /**
     * The last job has finished 5 ticks ago, so theoretically the handle should start closing in 15 ticks and take 5
     * ticks to do that
     */

    it('should automatically close when the timeout is exceeded', function (done) {
        setTimeout(function () {
            handle.isClosed().should.be.true;
            open.should.be.false;
            done();
        }, tickLength * 25);
    });

});