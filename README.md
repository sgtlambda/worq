# worq
[![Build Status][travis-image]][travis-url]
[![Code Quality][codeclimate-image]][codeclimate-url]
[![Code Coverage][coveralls-image]][coveralls-url]
[![NPM Version][npm-image]][npm-url]

A promising job queue

## Install

```bash
$ npm install --save worq
```

## Example

```js
var Worqer = require('worq'),
    exec   = require('child-process-promise').exec;

var execQueue = new Worqer(exec);

execQueue.process('ls -al').then(function (result) {
    console.log(result.stdout);
}).done();

execQueue.process('pwd').then(function (result) {
    console.log(result.stdout);
}).done();

// Above commands will be executed in series
```

## Usage

##### `new Worqer( [ Function.<Promise>, optional ] processor, [ Object, optional ] options )`

Creates a new worqer with an optionally specified `processor` function. The `processor` function **may** have any signature and **must** return a promise for the resulting value.

```js
var options = {

    // The number of jobs that can run simultaneously
    concurrency: 1, 
    
    // A function that is invoked, if the handle is in a closed state, before any jobs are processed.
    // May return a promise.
    open: undefined,
    
    // A function that is invoked when the job queue is empty and the timeout expires or when the handle is manually closed.
    // Executed before the promise returned by the .close() method resolves.
    // May return a promise.
    close: undefined,
    
    // The timeout (delay before the handle is closed when the job queue is empty)
    timeout: 0,
    
    // Whether to pass the thread number as the last argument to the process function
    passThreadNo: false
};
```

##### `[ Promise ] Worqer.process( [ data... ]  )`

Adds the given data to the job queue, returns a promise for the output data. Any arguments passed to this function will be passed to the Worqer's process function in the same order.

##### `[ boolean ] Worqer.hasActiveThreads( )`

Determines whether any of the threads is running a job

##### `[ boolean ] Worqer.hasJobsPending( )`

Returns whether there are jobs waiting to be handled in the queue

##### `[ boolean ] Worqer.isOpen( )`

Returns whether the handle is currently open

##### `[ boolean ] Worqer.isClosed()`

Returns whether the handle is currently closed

> Note that even though the return values of `Worqer.isOpen()` and `Worqer.isClosed()` are [mutually exclusive](http://en.wikipedia.org/wiki/Mutually_exclusive_events), they are by no means [collectively exhaustive](http://en.wikipedia.org/wiki/Collectively_exhaustive_events), since the Worqer could be in the middle of an open or close operation.

##### `[ Promise ] Worqer.close( [ boolean, optional ] graceful = true )`

Returns a promise for the handle to close.

**graceful** - Whether to let jobs in the job queue run first. If not, only lets currently running jobs finish and rejects any other jobs in the the job queue.

## License

MIT © JM Versteeg

[![dependency Status][david-image]][david-url]
[![devDependency Status][david-dev-image]][david-dev-url]

[travis-image]: https://img.shields.io/travis/jmversteeg/worq.svg?style=flat-square
[travis-url]: https://travis-ci.org/jmversteeg/worq

[codeclimate-image]: https://img.shields.io/codeclimate/github/jmversteeg/worq.svg?style=flat-square
[codeclimate-url]: https://codeclimate.com/github/jmversteeg/worq

[david-image]: https://img.shields.io/david/jmversteeg/worq.svg?style=flat-square
[david-url]: https://david-dm.org/jmversteeg/worq

[david-dev-image]: https://img.shields.io/david/dev/jmversteeg/worq.svg?style=flat-square
[david-dev-url]: https://david-dm.org/jmversteeg/worq#info=devDependencies

[coveralls-image]: https://img.shields.io/coveralls/jmversteeg/worq.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/jmversteeg/worq

[npm-image]: https://img.shields.io/npm/v/worq.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/worq
