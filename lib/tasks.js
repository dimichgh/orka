'use strict';

var assert = require('assert');

var async = require('async');
var DataHolder = require('raptor-async/DataHolder');

var Task = module.exports.Task = function Task(name, execFunc) {
    this.name = name;
    this.execFunc = execFunc;
    this.input = {
        dependencies: {}
    };
    this.output = new DataHolder();
    this.status = 'init';
};

var proto = Task.prototype;

proto.wait = function wait(callback) {
    var input = this.input;
    var keys = Object.keys(input.dependencies);
    if (keys.length) {
        var depTasks = keys.map(function iter(depName) {
            return input.dependencies[depName];
        });
        async.parallel(depTasks, callback);
    }
    else {
        callback();
    }
};

proto.isComplete = function isComplete() {
    return this.status === 'completed' || this.status === 'canceled';
};

proto.run = function run(ctx, callback) {
    var self = this;
    if (self.status === 'run') {
        return;
    }

    self.status = 'run';

    Object.defineProperty(this.input, 'ctx', {
        get: function get() {
            return ctx;
        }
    });

    this.execFunc(this.input, function complete(err, result) {
        if (self.isComplete()) {
            return;
        }
        self.status = 'completed';
        if (err) {
            self.output.reject(err);
        }
        else {
            self.output.resolve(result);
        }
    });

    self.output.done(callback);
};

proto.cancel = function cancel(err, defaultResult) {
    if (this.isComplete()) {
        return;
    }

    if (err) {
        this.output.reject(err);
        this.status = 'canceled';
        return;
    }
    this.output.resolve(defaultResult);
    this.status = 'canceled';
};

proto.addDependency = function addDependency(inName, task) {
    assert.ok(!this.input[inName], 'Task "'+this.name+'" already has task "'+task.name+'" as a dependency');
    var deps = this.input.dependencies = this.input.dependencies;
    deps[inName] = task.output;
    deps[inName] = function onData(callback) {
        task.output.done(callback);
    };
};
