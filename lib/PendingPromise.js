'use strict';

var Q = require('q');

/**
 * Constructs a new (defered) PendingPromise
 * @param {number} timeout A timeout in milliseconds after which the promise will be resolved or returned.
 * @param {boolean} [fulfill=true] Whether to fulfill or reject the promise when timeout ends
 * @param {*} [value] The value to fulfill the promise with
 * @param {Error|*} [reason] The error to reject the promise with
 * @constructor
 */
var PendingPromise = function (timeout, fulfill, value, reason) {
    this._defer = Q.defer();
    this._fulfill = typeof fulfill !== typeof true ? true : fulfill;
    this._value = value;
    this._reason = reason;
    this._timeout = setTimeout(function () {
        this.cancel();
    }.bind(this), timeout);
    this.promise = this._defer.promise;
};

/**
 * Cancels the pending promise (resolves or rejects immediately)
 * @param {boolean} [fulfill] If set, overrides the object's fulfill setting
 */
PendingPromise.prototype.cancel = function (fulfill) {
    clearTimeout(this._timeout);
    fulfill = typeof fulfill === typeof undefined ? this._fulfill : fulfill;
    if (fulfill)
        this._defer.resolve(this._value);
    else
        this._defer.reject(this._reason);
};

/**
 * Returns a promise that exposes a cancel method
 * @param {number} timeout A timeout in milliseconds after which the promise will be resolved or returned.
 * @param {boolean} [fulfill=true] Whether to fulfill or reject the promise when timeout ends
 * @param {*} [value] The value to fulfill the promise with
 * @param {Error|*} [reason] The error to reject the promise with
 */
var pending = function (timeout, fulfill, value, reason) {
    var pendingPromise = new PendingPromise(timeout, fulfill, value, reason);
    pendingPromise.promise.cancel = pendingPromise.cancel.bind(pendingPromise);
    return pendingPromise.promise;
};

module.exports = pending;