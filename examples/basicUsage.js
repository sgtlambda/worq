var Worqer = require('../'),
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