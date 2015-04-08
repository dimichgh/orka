'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var async = require('async');
var debug = require('debug')('orka:pubsub');

var utils = require('./utils');

var count = 1;

// Subscription topic
function Topic(name, options, emitter) {
    this.name = name;
    this.subscribers = [];
    this.queue = [];
    this.publishedEvents = {};
    this.options = options || {};
    this.emitter = emitter;
}

var tProto = Topic.prototype;

tProto.pub = tProto.publish = function publish(data, complete, callback) {

    if (arguments.length === 2) {
        if (typeof complete === 'function') {
            callback = complete;
            complete = false;
        }
    }

    assert.ok(data !== undefined && data !== null, 'Data should not be undefined or null');
    data.__publishedId = data.__publishedId || count++;
    if (this.publishedEvents[data.__publishedId]) {
        return this.options.strict && utils.boom(this.emitter, new Error('data has already been published: ' + data), callback);
    }
    // marked as published
    this.publishedEvents[data.__publishedId] = true;

    var topic = this.name;

    if (this.completed) {
        var err = new Error('Error: tried to publish after complete event');

        return callback ? callback(err) : this.emitter.emit('error', err);
    }

    var event;
    if (data instanceof Error) {
        debug(topic, 'publishing error', data);
        event = {
            type: 'reject',
            error: data
        };
    }
    else {
        debug(topic, 'publishing data', data);
        event = {
            type: 'resolve',
            data: data
        };
    }

    event.type = complete ? 'complete' : event.type;

    // for future subscribers
    debug(topic, 'added to queue for future subscribers');
    this.queue.push(event);
    // notify current subscribers
    this.notifyAll(event, callback);
};

tProto.sub = tProto.subscribe = function subscribe(subscriber, callback) {
    var topic = this.name;
    this.subscribers.push(subscriber);
    debug(topic, 'added new subscriber:', subscriber.name);
    // handle backlog for new subscriber
    var actions = this.queue.map(function map(event) {
        return function (next) {
            setImmediate(function () {
                debug(topic, 'backlog: notifying subscriber', subscriber.name, 'with event:', event);
                subscriber(event.error, event.data, event.type === 'complete');
                next();
            });
        };
    });
    callback ? debug(topic, 'subscribe callback is provided') : debug(topic, 'subscribe callback is not provided');
    async.parallel(actions, function (err, result) {
        callback && callback(err, result);
        debug(topic, 'backlog: complete');
    });
};

tProto.complete = function complete(data, callback) {
    var topic = this.name;
    debug(topic, 'completing ...');
    this.pub(data, true, function (err, result) {
        debug(topic, 'completed');
        callback && callback(err, result);
    });
    this.completed = true;
};

tProto.notifyAll = function notifyAll(event, callback) {
    assert.ok(!callback || typeof callback === 'function', 'callback must be a function');
    var topic = this.name;
    if (this.subscribers.length) {
        debug(topic, 'notifying subscribers, total:', this.subscribers.length);
        var actions = this.subscribers.map(function map(subscriber) {
            return function (next) {
                setImmediate(function () {
                    debug(topic, 'notifying subscriber', subscriber.name, 'with event', event);
                    subscriber(event.error, event.data, event.type === 'complete');
                    next();
                });
            };
        });
        callback ? debug(topic, 'callback is provided') : debug(topic, 'callback is not provided');
        async.parallel(actions, callback || function noop() {});
    }
    else {
        debug(topic, 'no subscribers registered');
        callback && callback();
    }
};

module.exports.Topic = Topic;

// Subscription manager
function PubSub(name, options) {
    EventEmitter.call(this);
    this.name = name;
    this.topics = {};
    this.options = options || {
        strict: true
    };
}

util.inherits(PubSub, EventEmitter);

var psProto = PubSub.prototype;

psProto.topic = function topic(topicName) {
    assert.ok(topicName, 'topic must not be undefined or empty');
    return this.topics[topicName] || (this.topics[topicName] = new Topic(topicName, this.options));
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

psProto.link = function link(fromTopic, toTopic) {
    var _this = this;
    this.topic(fromTopic).sub(function topicFrom(err, data, complete) {
        _this.topic(toTopic).pub(err || data, complete, function (err) {
            err && _this.emit('error', err);
        });
    });
};

psProto.exists = function exists(topic) {
    return !!this.topics[topic];
};

psProto.reset = function reset() {
    this.topic = {};
};

module.exports.create = function create(name) {
    return new PubSub(name);
};
