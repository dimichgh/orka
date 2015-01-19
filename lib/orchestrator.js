'use strict';

var DataHolder = require('raptor-async/DataHolder');
var async = require('async');

var utils = require('./utils');
var Task = require('./tasks').Task;

var Orchestrator = module.exports.Orchestrator = function Orchestrator(plan, options) {    
    this.plan = plan;
    this.config = options;
    this.registry = {};
};

var proto = Orchestrator.prototype;

proto.start = function start(ctx, callback) {
    // generate task list
    var tasks = this.loadTasks(Object.keys(this.plan));
    // now run them
    var funcs = tasks.reduce(function forEach(memo, task) {
        memo.push(function exec(cb) {
            // start the task
            task.run(ctx, function (err, result) {
                cb(null, {
                    name: task.name,
                    err: err,
                    output: result                    
                });
            });
        });
        return memo;
    }, []);

    // wait for task to compete
    async.parallel(funcs, function (err, taskResults) {
        taskResults = !err && taskResults.reduce(function iter(memo, taskResult) {
            memo[taskResult.name] = taskResult;
            return memo;
        }, {});
        callback(err, taskResults);
    });

    return {
        stop: function stop(state) {
            state = state || new Error('Tasks stopped');
            var tasksToStop = state.tasks;

            tasks.filter(function iter(task) {
                return tasksToStop ? tasksToStop[task.name] : true;
            }).forEach(function forEach(task) {

                var err = state instanceof Error ? state : undefined;
                var defaultResult = !err ? state : undefined;

                var taskDefault = tasksToStop && tasksToStop[task.name] || defaultResult;
                err = err ? err : taskDefault.err;
                task.cancel(err, !err ? taskDefault : undefined);
            });
        }
    };
};

proto.loadTasks = function loadTasks(taskNames) {
    var self = this;

    var tasks = taskNames.reduce(function (memo, taskName) {
        // load task
        var task = self.loadTask(taskName);
        memo[taskName] = task;

        var dependencies = self.plan[taskName] || {};
        Object.keys(dependencies).forEach(function forEach(inputName) {
            var name = dependencies[inputName];
            var depTask = self.loadTask(name);
            memo[name] = depTask;
            task.addDependency(inputName, depTask);
        });
        
        return memo;
    }, {});

    return Object.keys(tasks).map(function (name) {
        return tasks[name];
    }, []);
};

proto.loadTask = function loadTask(name) {
    var task = this.registry[name];
    if (task) {
        return task;
    }
    // load task
    var exec = this.config.load(name) || function exec(input, callback) {
        callback(new Error('Task ' + name + ' cannot be found'));      
    };

    return this.registry[name] = new Task(name, exec);
};

