'use strict';

var assert = require('assert');

var async = require('async');
var debug = require('debug')('orka:pubsub');

// Subscription topic
function Topic(name) {
    this.name = name;
    this.subscribers = [];
    this.queue = [];
}

var tProto = Topic.prototype;

tProto.pub = tProto.publish = function publish(data, complete, callback) {
    var args = [].slice.call(arguments);
    callback = args.pop();
    data = args.shift();
    complete = args.shift();

    if (this.completed) {
        var err = new Error('Error: tried to publish after complete event');
        console.error(err.message,
            data, err);
        return callback(err); // skip it
    }

    var event;
    if (data instanceof Error) {
        debug('publishing error', data);
        event = {
            type: 'reject',
            error: data
        };
    }
    else {
        debug('publishing data', data);
        event = {
            type: 'resolve',
            data: data
        };
    }

    event.type = complete ? 'complete' : event.type;

    // for future subscribers
    debug('added to queue for future subscribers');
    this.queue.push(event);
    // notify current subscribers
    this.notifyAll(event, callback);
};

tProto.sub = tProto.subscribe = function subscribe(subscriber, callback) {
    this.subscribers.push(subscriber);
    debug('added new subscriber:', subscriber.name);
    // handle backlog for new subscriber
    var actions = this.queue.map(function map(event) {
        return function (next) {
            setImmediate(function () {
                debug('backlog: notifying subscriber', subscriber.name, 'with event:', event);
                subscriber(event.error, event.data, event.type === 'complete');
                next();
            });
        };
    });
    callback ? debug('subscribe callback is provided') : debug('subscribe callback is not provided');
    async.parallel(actions, function (err, result) {
        callback && callback(err, result);
        debug('backlog: complete');
    });
};

tProto.complete = function complete(data, callback) {
    debug('completing ...');
    this.pub(data, true, function (err, result) {
        debug('completed');
        callback && callback(err, result);
    });
    this.completed = true;
};

tProto.notifyAll = function notifyAll(event, callback) {
    if (this.subscribers.length) {
        debug('notifying subscribers, total:', this.subscribers.length);
        var actions = this.subscribers.map(function map(subscriber) {
            return function (next) {
                setImmediate(function () {
                    debug('notifying subscriber', subscriber.name, 'with event', event);
                    subscriber(event.error, event.data, event.type === 'complete');
                    next();
                });
            };
        });
        callback ? debug('callpack is provided') : debug('callpack is not provided');
        async.parallel(actions, callback || function noop() {});
    }
    else {
        debug('no subscribers registered');
        callback && callback();
    }
};

module.exports.Topic = Topic;

// Subscription manager
function PubSub(name) {
    this.name = name;
    this.topics = {};
}

var psProto = PubSub.prototype;

psProto.topic = function topic(topicName) {
    return this.topics[topicName] || (this.topics[topicName] = new Topic(topicName));
};

psProto.complete = function complete(data, callback) {
    var topics = this.topics;
    var actions = Object.keys(topics).map(function map(name) {
        return function (next) {
            topics[name].complete(data, next);
        };
    });

    async.parallel(actions, callback || function noop() {});
};

psProto.reset = function reset() {
    this.topic = {};
};

module.exports.create = function create(name) {
    return new PubSub(name);
};
