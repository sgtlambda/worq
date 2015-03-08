var should = require('should'),
    Job    = require('../lib/Job'),
    Thread = require('../lib/Thread');

describe('Thread', function () {

    var thread = new Thread();

    it('should have a job property', function () {
        thread.should.have.property('job');
    });

    describe('isOpen()', function () {

        it('should return false if the job property is not null', function () {
            thread.isOpen().should.be.true;
            thread.job = new Job();
            thread.isOpen().should.be.false;
        });

    });

});