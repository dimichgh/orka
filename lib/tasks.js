'use strict';

var assert = require('assert');

var DataHolder = require('raptor-async/DataHolder');

var Task = module.exports.Task = function Task(name, execFunc) {
    this.name = name;
    this.execFunc = execFunc;
    this.input = {};
    this.output = new DataHolder();
    this.status = 'init';
};

var proto = Task.prototype;

proto.isComplete = function isComplete() {
    return this.status === 'completed' || this.status === 'canceled';
};

proto.run = function run(ctx, callback) {
    var self = this;
    if (self.status === 'run') {
        return;
    }

    self.status = 'run';
    this.onComplete = function onComplete(err, result) {
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

        callback(err, result);
    };

    Object.defineProperty(this.input, 'ctx', {
        get: function get() {
            return ctx;
        }
    });

    this.execFunc(this.input, this.onComplete);    
};

proto.cancel = function cancel(err, defaultResult) {
    if (this.status === 'init' || this.isComplete()) {
        return;
    }

    if (err) {
        this.onComplete(err);
        this.output.reject(err);
        this.status = 'canceled';
        return;
    }
    this.onComplete(null, defaultResult);
    this.output.resolve(defaultResult);
    this.status = 'canceled';
};

proto.addDependency = function addDependency(inName, task) {
    assert.ok(!this.input[inName], 'Task "'+this.name+'" already has task "'+task.name+'" as a dependency');
    this.input[inName] = task.output;
    this.input[inName] = function onData(callback) {
        task.output.done(callback);
    };
};