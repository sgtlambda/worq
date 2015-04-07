# worq
[![Build Status][travis-image]][travis-url]
[![Code Quality][codeclimate-image]][codeclimate-url]
[![Code Coverage][coveralls-image]][coveralls-url]
[![NPM Version][npm-image]][npm-url]

Promise-based threaded job queue

## Install

```bash
$ npm install --save worq
```

## Usage

```js
var Worqer = require('worq'),
    exec   = require('child-process-promise').exec;

var execQueue = new Worqer(exec, {
    concurrency: 1
});

execQueue.process('ls -al').then(function (result) {
    console.log(result.stdout);
}).done();

execQueue.process('pwd').then(function (result) {
    console.log(result.stdout);
}).done();

// Above commands will be executed in series
```

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