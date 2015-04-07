'use strict';

var Promise = require('bluebird');

/**
 * Constructs a new (defered) PendingPromise
 * @param {number} timeout A timeout in milliseconds after which the promise will be resolved or returned.
 * @param {boolean} [fulfill=true] Whether to fulfill or reject the promise when timeout ends
 * @param {*} [value] The value to fulfill the promise with
 * @param {Error|*} [reason] The error to reject the promise with
 * @constructor
 */
var PendingPromise = function (timeout, fulfill, value, reason) {
    this.promise = new Promise(function () {
        this.resolve = arguments[0].bind(this, value);
        this.reject = arguments[1].bind(this, reason);
    }.bind(this));
    this._fulfill = typeof fulfill !== typeof true ? true : fulfill;
    this._timeout = setTimeout(function () {
        this.cancel();
    }.bind(this), timeout);
};

/**
 * Cancels the pending promise (resolves or rejects immediately)
 * @param {boolean} [fulfill] If set, overrides the object's fulfill setting
 */
PendingPromise.prototype.cancel = function (fulfill) {
    clearTimeout(this._timeout);
    fulfill = typeof fulfill === typeof undefined ? this._fulfill : fulfill;
    if (fulfill) this.resolve();
    else this.reject();
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