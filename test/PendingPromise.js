var should  = require('should'),
    pending = require('../lib/PendingPromise');

describe('PendingPromise', function () {
    var tickLength = 10;
    it('should resolve after the defined timeout', function (done) {
        var promise = pending(tickLength * 2);
        setTimeout(function () {
            promise.isFulfilled().should.be.false;
        }, tickLength);
        setTimeout(function () {
            promise.isFulfilled().should.be.true;
            done();
        }, tickLength * 3);
    });
    describe('cancel()', function (done) {
        it('should immediately resolve or reject the promise', function (done) {
            var reason = 'the promise was canceled';
            var caughtReason;
            var promise = pending(tickLength * 4, true, null, new Error(reason));
            promise.catch(function (reason) {
                caughtReason = reason;
            });
            setTimeout(function () {
                promise.cancel(false);
            }, tickLength * 2);
            setTimeout(function () {
                should.throws(function () {
                    throw caughtReason;
                }, reason);
                done();
            }, tickLength * 3);
        });
    });
});