'use strict';

var async = require('async');
var assert = require('assert');

var debug = require('debug')('orka:orchestration');

var pubsub = require('./pub-sub');
var utils = require('./utils');

var registry = {};

var Orchestrator = module.exports.Orchestrator = function Orchestrator(plan, options) {
    this.pubsub = pubsub.create('orchestrator');
    this.config = options;

    if (!plan) {
        return;
    }

    utils.validatePlan(plan);

    this.tasks = utils.normalizePlan(plan);

    debug('execution plan', '\n', this.tasks);
};

var proto = Orchestrator.prototype;

proto.run = function run(taskFn) {
    var pubsub = this.pubsub;

    taskFn({
        get: function get(name, callback) {
            assert.ok(name, 'name must be provided');
            pubsub.topic(name).sub(callback);
        }
    }, {
        set: function set(name, value) {
            assert.ok(arguments.length === 1 || name, 'name must be provided');
            if (arguments.length === 1) {
                value = name;
                name = taskFn.id;
            }

            pubsub.topic(name).pub(value);
            // always publish it under task name
            name !== taskFn.id && pubsub.topic(taskFn.id).pub(value);
        }
    });

    return {
        get: function get(topic, callback) {
            pubsub.topic(topic).sub(callback);
        }
    };
};

proto.start = function start(ctx, callback) {
    var pubsub = this.pubsub;
    var run = this.run.bind(this);

    if (typeof ctx === 'function') {
        callback = ctx;
        ctx = undefined;
    }

    this.tasks.forEach(function forEach(def) {
        var name = def.name;
        // load task
        var task = this.loadTask(name);

        // subscribe to input topics
        if (def.in) {
            Object.keys(def.in).forEach(function forEach(inName) {
                var topic = def.in[inName];
                // if there is mapping between input field and external topic, then link them
                if (topic !== inName) {
                    pubsub.link(topic, inName);
                }
            }, this);
        }

        // link out fields to output topics if any
        if (def.out) {
            Object.keys(def.out).forEach(function forEach(outName) {
                var topic = def.out[outName];
                // if there is mapping between input field and external topic, then link them
                if (topic !== outName) {
                    pubsub.link(outName, topic);
                }
            }, this);
        }

        if (def.if) {
            var keys = Object.keys(def.if);
            if (keys.length > 0) {

                if (keys.length > 1) {
                    pubsub.topic(keys[0]).sub(function execOnPub(err, data, complete) {
                        if (complete) {
                            // do not execute
                            return;
                        }
                        run(task);
                    });
                }
                else {
                    // multiple topics
                    var waitActions = keys.map(function map(topic) {
                        return function waitForTopic(next) {
                            pubsub.topic(topic).sub(function waitForTopicToExecMulti(err, data, complete) {
                                if (complete) {
                                    err = new Error('stop');
                                    err.complete = true;
                                    return next(err);
                                }
                                // let execute
                                next();
                            });
                        };
                    });
                    async.parallel(waitActions, function groupTopicExec(err) {
                        if (err && err.complete) {
                            return;
                        }
                        run(task);
                    });
                }
                return;
            }
        }

        run(task);

    }, this);

    return {
        get: function get(topic, callback) {
            pubsub.topic(topic).sub(callback);
        }
    };
};

proto.loadTask = function loadTask(name) {
    var task = registry[name];
    if (task) {
        return task;
    }
    // load task
    task = registry[name] = this.config.load(name) || utils.tryRequire(name) || function exec(input, output) {
        output.set('error', new Error('Task ' + name + ' cannot be found'));
    };

    task.id = name;

    return task;
};

module.exports.reset = function reset() {
    registry = {};
};
