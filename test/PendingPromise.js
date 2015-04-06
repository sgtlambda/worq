'use strict';

require('./support/bootstrap');

var pending = require('../lib/PendingPromise');

describe('PendingPromise', function () {
    var tickLength = 1;
    it('should resolve after the defined timeout', function (done) {
        var promise = pending(tickLength * 2);
        setTimeout(function () {
            return promise.isFulfilled().should.be.false;
        }, tickLength);
        setTimeout(function () {
            promise.isFulfilled().should.be.true;
            done();
        }, tickLength * 3);
    });
    describe('cancel()', function (done) {
        it('should immediately resolve or reject the promise', function () {
            var reason = 'the promise was canceled';
            var promise = pending(tickLength * 2, true, null, new Error(reason));
            setTimeout(function () {
                promise.cancel(false);
            }, tickLength * 1);
            return promise.should.be.rejectedWith(reason);
        });
    });
});