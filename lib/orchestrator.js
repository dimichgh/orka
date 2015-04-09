'use strict';

var async = require('async');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

var debug = require('debug')('orka:orchestration');

var pubsub = require('./pub-sub');
var utils = require('./utils');

var registry = {};

var Orchestrator = module.exports.Orchestrator = function Orchestrator(plan, options) {
    EventEmitter.call(this);

    this.pubsub = pubsub.create('orchestrator');
    this.config = options;

    if (!plan) {
        return;
    }

    utils.validatePlan(plan);

    this.tasks = utils.normalizePlan(plan);
    this.plan = plan;

    var orc = this;
    this.errorListener = this.errorListener || function errorListener(err) {
        if (err.type === 'pubsub:publish:after-complete' && orc.tolerant) {
            return;
        }
        orc.emit('error', err);
    };
    this.pubsub.on('error', this.errorListener);

    debug('execution plan', '\n', this.tasks);
};

require('util').inherits(Orchestrator, EventEmitter);

var proto = Orchestrator.prototype;

proto.on = function on(event, callback) {
    this.pubsub.on(event, callback);
    return this;
};

proto.tolerant = function tolerant(value) {
    this.tolerant = value;
    return this;
};

proto.run = function run(taskName, taskFn, ctx) {
    var pubsub = this.pubsub;
    if (typeof taskName === 'function') {
        ctx = taskFn;
        taskFn = taskName;
        taskName = taskFn.id || taskFn.name;
    }

    taskFn({
        get: function get(name, callback) {
            assert.ok(name, 'name must be provided');
            pubsub.topic(taskName + ':' + name).sub(callback);
        },
        getInputNames: function getInputNames() {
            return taskFn.inputNames;
        },
        ctx: ctx
    }, {
        set: function set(name, value) {
            assert.ok(arguments.length === 1 || name, 'name must be provided');
            if (arguments.length === 1) {
                value = name;
                name = taskFn.id;
            }

            name !== taskName && pubsub.topic(taskName + ':' + name).pub(value);
            // always publish it under task name
            pubsub.topic(name).pub(value);
        },
        getOutputNames: function getOutputNames() {
            return taskFn.outputNames;
        }
    });

    return {
        get: function get(topic, callback) {
            pubsub.topic(topic).sub(callback);
        }
    };
};

proto.start = function start(ctx) {
    var pubsub = this.pubsub;
    var run = this.run.bind(this);
    var orc = this;

    this.tasks.forEach(function forEach(def) {
        var name = def.name;
        // load task
        var task = this.loadTask(name);

        // subscribe to input topics
        if (def.in) {
            var inNames = [];
            Object.keys(def.in).forEach(function forEach(inName) {
                inNames.push(inName);
                var topic = def.in[inName];
                // if there is mapping between input field and external topic, then link them
                pubsub.link(topic, name + ':' + inName);
            }, this);
            task.inputNames = inNames;
        }

        // link out fields to output topics if any
        if (def.out) {
            var outNames = [];
            Object.keys(def.out).forEach(function forEach(outName) {
                outNames.push(outName);
                var topic = def.out[outName];
                // if there is mapping between input field and external topic, then link them
                if (topic !== outName) {
                    pubsub.link(name + ':' + outName, topic);
                }
            }, this);
            task.outputNames = outNames;
        }

        // conditional execution
        if (def.after) {
            var keys = Object.keys(def.after);
            if (keys.length > 0) {

                if (keys.length > 1) {
                    pubsub.topic(keys[0]).sub(function execOnPub(err, data, complete) {
                        if (complete) {
                            // do not execute
                            return;
                        }
                        run(name, task, ctx);
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
                        run(name, task, ctx);
                    });
                }
                return;
            }
        }

        run(name, task, ctx);

    }, this);

    var control = {
        get: function get(topic, callback) {
            pubsub.topic(topic).sub(callback);
            return control;
        },
        on: function on(topic, callback) {
            pubsub.topic(topic).sub(callback);
            return control;
        },
        task: function task(name) {
            assert.ok(typeof orc.plan === 'object' && orc.plan[name] !== undefined ||
                Array.isArray(orc.plan) && orc.plan.indexOf(name) !== -1, 'task does not exists in orchestrator, name: ' + name);
            var topic = pubsub.topic(name);
            return {
                stop: function stop(data, callback) {
                    topic.complete(data, callback);
                    return control;
                }
            };
        },
        stop: function stop(data, callback) {
            pubsub.complete(data, callback);
            return control;
        }
    };

    return control;
};

proto.loadTask = function loadTask(name) {
    var task = registry[name];
    if (task && !task.refresh) {
        return task;
    }

    var notFountTask = function notFountTask(input, output) {
        output.set(new Error('Task ' + name + ' cannot be found'));
    };
    notFountTask.refresh = true;
    // load task
    task = registry[name] = this.config.load(name) || utils.tryRequire(name) || notFountTask;

    task.id = name;

    return task;
};

module.exports.reset = function reset() {
    registry = {};
};
