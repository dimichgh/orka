'use strict';

var assert = require('assert');

var async = require('async');

var pubsub = require('../lib/pub-sub');

describe.only(__filename, function () {

    it('should create subscribe manager', function() {
        var manager = pubsub.create('test manager');
        assert.ok(manager);
        assert.equal('test manager', manager.name);
        assert.ok(!manager.topics.length);
    });

    it('should create two separate subscribe managers', function() {
        var managerA = pubsub.create('test manager A');
        var managerB = pubsub.create('test manager B');
        assert.equal('test manager A', managerA.name);
        assert.equal('test manager B', managerB.name);
        assert.notEqual(managerA, managerB);
    });

    it('should create and return the same instance of topic', function() {
        var manager = pubsub.create('test manager');
        assert.ok(manager.topic('topic1') === manager.topic('topic1'));
        var topic = manager.topic('topic1');
        assert.equal('topic1', topic.name);
        assert.ok(topic.queue);
        assert.equal(0, topic.queue.length);
        assert.ok(topic.subscribers);
        assert.equal(0, topic.subscribers.length);
    });

    it('should register subscribers', function() {
        var manager = pubsub.create('test manager');
        var topic = manager.topic('A');
        topic.subscribe(function subA(err, data) {
        });
        topic.subscribe(function subB(err, data) {
        });
        assert.equal(2, topic.subscribers.length);
    });

    it('should publish to subscribers', function(done) {
        var manager = pubsub.create('test manager');
        var topic = manager.topic('A');
        var count = 0;
        topic.sub(function subA(err, data) {
            assert.ok(!err);
            assert.equal('result', data);
            count++;
        });
        topic.sub(function subB(err, data) {
            assert.ok(!err);
            assert.equal('result', data);
            count++;
        });
        topic.pub('result', function () {
            assert.equal(2, count);
            assert.equal(1, topic.queue.length);
            done();
        });
    });

    it('should publish to subscriber, complete and try to publish again which will be skipped', function(done) {
        var manager = pubsub.create('test manager');
        var topic = manager.topic('A');
        var count = 0;
        topic.sub(function subA(err, data, complete) {
            assert.ok(!err);
            complete ?
                assert.equal('done', data) :
                assert.equal('result', data);

            count++;
        });

        async.series([
            topic.pub.bind(topic, 'result'),
            function validate(next) {
                assert.equal(1, count);
                assert.equal(1, topic.queue.length);
                next();
            },
            topic.pub.bind(topic, 'result'),
            function validate(next) {
                assert.equal(2, count);
                assert.equal(2, topic.queue.length);
                next();
            },
            manager.complete.bind(manager, 'done'),
            function validate(next) {
                assert.equal(3, count);
                assert.equal(3, topic.queue.length);
                next();
            },
            topic.pub.bind(topic, 'result')
        ], function (err) {
            assert.ok(err);
            assert.equal('Error: tried to publish after complete event', err.message);
            done();
        });
    });

    it('should publish to one subscriber and then process backlog for the other, single topic', function(done) {
        var manager = pubsub.create('test manager');
        var topic = manager.topic('A');
        var count = 0;
        topic.sub(function subA(err, data) {
            assert.ok(!err);
            assert.equal('result', data);
            count++;
        });
        topic.pub('result', function () {
            assert.equal(1, count);
        });
        topic.pub('result', function () {
            assert.equal(2, count);
        });
        assert.equal(2, topic.queue.length);
        assert.deepEqual([{'type':'resolve','data':'result'},{'type':'resolve','data':'result'}], topic.queue);

        topic.sub(function subB(err, data) {
            assert.ok(!err);
            assert.equal('result', data);
            count++;
        }, function () {
            assert.equal(4, count);
            assert.equal(2, topic.queue.length);

            topic.pub('result', function () {
                assert.equal(6, count);
                assert.equal(3, topic.queue.length);
                done();
            });
        });

    });

    it('should publish to one subscriber and then process backlog for the other, single topic, complete at the end', function(done) {
        var manager = pubsub.create('test manager');
        var topic = manager.topic('A');
        var count = 0;
        topic.sub(function subA(err, data, complete) {
            assert.ok(!err);
            complete ? assert.equal('done', data) : assert.equal('result', data);
            count++;
        });
        topic.pub('result', function () {
            assert.equal(1, count);
        });
        topic.pub('result', function () {
            assert.equal(2, count);
        });
        assert.equal(2, topic.queue.length);
        assert.deepEqual([{'type':'resolve','data':'result'},{'type':'resolve','data':'result'}], topic.queue);

        topic.sub(function subB(err, data, complete) {
            assert.ok(!err);
            complete ? assert.equal('done', data) : assert.equal('result', data);
            count++;
        }, function () {
            assert.equal(4, count);
            assert.equal(2, topic.queue.length);

            topic.pub('result', function () {
                assert.equal(6, count);
                assert.equal(3, topic.queue.length);
                manager.complete('done', function () {
                    assert.equal(8, count);
                    assert.equal(4, topic.queue.length);
                    done();
                });
            });
        });

    });

    it('should publish to one subscriber and then process backlog for the other, single topic, complete with error', function(done) {
        var manager = pubsub.create('test manager');
        var topic = manager.topic('A');
        var count = 0;
        topic.sub(function subA(err, data, complete) {
            assert.ok(complete && err || !complete && !err);
            complete ?
                assert.equal('test error', err.message) :
                assert.equal('result', data);
            count++;
        });
        topic.pub('result', function () {
            assert.equal(1, count);
        });
        topic.pub('result', function () {
            assert.equal(2, count);
        });
        assert.equal(2, topic.queue.length);
        assert.deepEqual([{'type':'resolve','data':'result'},{'type':'resolve','data':'result'}], topic.queue);

        topic.sub(function subB(err, data, complete) {
            assert.ok(complete && err || !complete && !err);
            complete ? assert.equal('test error', err.message) : assert.equal('result', data);
            count++;
        }, function () {
            assert.equal(4, count);
            assert.equal(2, topic.queue.length);

            topic.pub('result', function () {
                assert.equal(6, count);
                assert.equal(3, topic.queue.length);
                manager.complete(new Error('test error'), function () {
                    assert.equal(8, count);
                    assert.equal(4, topic.queue.length);
                    done();
                });
            });
        });

    });

});
