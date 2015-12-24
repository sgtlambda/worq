# worq

> Promising job queue

Run promises in series or with a configurable concurrency limit

[![Build Status][travis-image]][travis-url]
[![Code Quality][codeclimate-image]][codeclimate-url]
[![Code Coverage][coveralls-image]][coveralls-url]
[![NPM Version][npm-image]][npm-url]

## Install

```bash
$ npm install --save worq
```

## Usage

```js
const Queue = require('worq');

var queue = new Queue();

queue.run([
    () => somePromisingFunction(),
    () => someOtherPromisingFunction()
    
    // these functions will be executed in series
    
]).then(results => {

    // results will contain an array of the fulfillment values
    
});
```

## API

### `Queue([options])`

#### options

##### concurrency

Type: `number`
Default: `1`

The maximum number of jobs that can run simultaneously

### `Queue.run(jobs)`

#### jobs

Type: `Function[]`

An array of jobs. Jobs may return/throw regularly or return a promise.

Returns a promise for an array containing the fulfillment values in the same order.

### `Queue.cancel()`

Cancels the remaining jobs.

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
