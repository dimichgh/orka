'use strict';

var assert = require('assert');

var Orchestrator = require('../lib/orchestrator').Orchestrator;

describe(__filename, function () {

    it('should fail to load task', function (done) {
        var orc = new Orchestrator(undefined, {
            load: function load(name) {
            }
        });

        var task = orc.loadTask('A');
        assert.ok(task);
        assert.ok(task.execFunc);
        assert.ok(task.input);
        assert.ok(task.output);
        task.execFunc({}, function (err, result) {
            assert.ok(err);
            done();
        });
    });

    it('should load task', function (done) {
        var execFunc = createTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var task = orc.loadTask('A');
        assert.ok(task);
        assert.ok(task.input);
        assert.ok(task.output);
        assert.equal(execFunc, task.execFunc);
        assert.equal(task, orc.registry.A);

        // make sure it is cached
        var task2 = orc.loadTask('A');
        assert.equal(task, task2);
        assert.ok(task2);
        assert.ok(task2.input);
        assert.ok(task2.output);
        assert.equal(execFunc, task2.execFunc);

        task2.execFunc('input', function (err, result) {
            assert.equal('input', result);
            done();
        });
    });

    it('should load single task', function () {
        var execFunc = createTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var tasks = orc.loadTasks(['A']);

        assert.equal(1, tasks.length);
    });

    it('should load 2 nested tasks', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B')
        };

        var orc = new Orchestrator({
            A: [
                'B'
            ]
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        });

        var tasks = orc.loadTasks(['A']);

        assert.equal(2, tasks.length);
        assert.equal('A', tasks[0].execFunc.id);
        assert.equal('B', tasks[1].execFunc.id);
    });

    it('should load 2 tasks', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B')
        };

        var orc = new Orchestrator({
            A: [],
            B: []
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        });

        var tasks = orc.loadTasks(['A', 'B']);

        assert.equal(2, tasks.length);
        assert.equal('A', tasks[0].execFunc.id);
        assert.equal('B', tasks[1].execFunc.id);
    });

    it('should load 3 tasks', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B'),
            C: createTask('C')
        };

        var orc = new Orchestrator({
            A: [
                'B'
            ],
            B: [
                'C'
            ]
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        });

        var tasks = orc.loadTasks(['A']);

        assert.equal(2, tasks.length);
        assert.equal('A', tasks[0].execFunc.id);
        assert.equal('B', tasks[1].execFunc.id);
    });

});

function createTask(name) {
    function execFunc(input, callback) {
        callback(null, input);
    }
    execFunc.id = name;
    return execFunc;    
}