var should = require('should'),
    Job    = require('../lib/Job');

describe('Job', function () {

    var job = new Job('foo');

    it('should expose a data property', function () {
        job.getData().should.be.exactly('foo');
    });

    it('should provide the EventEmitter API', function () {
        job.emit.should.be.Function;
        job.on.should.be.Function;
        job.once.should.be.Function;
    });

});