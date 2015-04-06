// This simple example demonstrates basic usage of the Worqer API.
// Real-life use cases would often be dealing with a remote connection such as SSH

var Worqer = require('../'),
    Q      = require('q');

// Some helper code to clarify the output log
var start              = new Date().getTime(),
    logWithElapsedTime = function (msg) {
        var now = new Date();
        now.setTime(now.getTime() - start);
        console.log('[' + now.toLocaleTimeString().substring(3, 7) + '] ' + msg);
    };

// Declare the Worqer
var handle = new Worqer(

    function (threadNo, data) {
        logWithElapsedTime('Performing lengthy operations on ' + data +
        ' (thread ' + threadNo + ')');
        return Q(data.toUpperCase()).delay(1000);
    }, {

        concurrency: 2,
        timeout:     3000,

        open:        function () {
            logWithElapsedTime('opening');
            return Q('open').delay(1000).then(logWithElapsedTime);
        },

        close:       function () {
            logWithElapsedTime('closing');
            return Q('closed').delay(1000).then(logWithElapsedTime);
        }

    });

//Queue some jobs
['foobar', 'foobaz', 'barbaz'].forEach(function (sample) {
    handle.process(sample).then(function (result) {
        logWithElapsedTime('The result of ' + sample + ': ' + result);
    });
});

handle.close(true);
// Gracefully closes the handle (waits for the job queue to finish processing, then closes)
// The handle would have automatically closed after the predefined timeout of three seconds
// if the close method had not been invoked manually.
