'use strict';

var assert = require('assert');

var async = require('async');

var Orchestrator = require('../lib/orchestrator').Orchestrator;
var index = require('../lib');

describe(__filename, function () {

    it('should fail to run task', function (done) {
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
            }
        });

        orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('Task A cannot be found', result.A.err.message);
            done();
        });
    });

    it('should run a single task', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(!result.A.err);
            assert.equal('bar', result.A.output.input.ctx.foo);
            done();
        });
    });

    it('should run two parallel tasks', function (done) {
        var tasks = {
            A: createNonMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator([
            'A',
            'B'
        ], {
            load: function load(name) {
                return tasks[name];
            }
        });

        orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal(2, Object.keys(result).length);

            assert.ok(!result.A.err);
            assert.equal('bar', result.A.output.input.ctx.foo);

            assert.ok(!result.B.err);
            assert.equal('bar', result.B.output.input.ctx.foo);

            done();
        });
    });

    it('should run two tasks, one depends on the other', function (done) {
        var tasks = {
            A: createMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: {
                data: 'B'
            }
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var ctx = {
            foo: 'bar'
        };
        orc.start(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal(2, Object.keys(result).length);

            assert.ok(!result.A.err);
            assert.equal('bar', result.A.output.input.ctx.foo);

            assert.ok(!result.B.err);
            assert.equal('bar', result.B.output.input.ctx.foo);

            assert.equal('B->A', ctx.chain.join('->'));

            done();
        });
    });

    it('should run many tasks, some depend on the others', function (done) {
        var tasks = {
            A: createMappedTask('A'),
            B: createMappedTask('B'),
            C: createNonMappedTask('C'),
            D: createMappedTask('D')
        };

        var ctx = {
            foo: 'bar'
        };

        index.start({
            A: {
                dataB: 'B',
                dataC: 'C'
            },
            B: {
                dataC: 'C'
            },
            D: {
                dataA: 'A',
                dataB: 'B'
            }
        }, {
            load: function load(name) {
                return tasks[name];
            },
            ctx: ctx
        }, function (err, result) {
            assert.ok(!err);
            assert.equal(4, Object.keys(result).length);
            assert.equal('C->B->A->D', ctx.chain.join('->'));

            done();
        });

    });

    it('should run many tasks, some depend on the others, mapped tasks', function (done) {
        var tasks = {
            A: createMappedTask('A'),
            B: createMappedTask('B'),
            C: createNonMappedTask('C'),
            D: createMappedTask('D')
        };

        var ctx = {
            foo: 'bar'
        };

        index.start({
            A: {
                dataFromB: 'B',
                dataFromC: 'C'
            },
            B: ['C'],
            D: {
                dataFromA: 'A',
                dataFromB: 'B'
            }
        }, {
            load: function load(name) {
                return tasks[name];
            },
            ctx: ctx
        }, function (err, result) {
            assert.ok(!err);
            assert.equal(4, Object.keys(result).length);
            assert.equal('C->B->A->D', ctx.chain.join('->'));

            done();
        });

    });

    it('should cancel a single task', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator(['A'], {
            load: function load(name) {
                return execFunc;
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(result.A.err);
            assert.equal('test error', result.A.err.message);
            done();
        });

        control.stop(new Error('test error'));
    });

    it('should cancel a single task gracefully with default result for all tasks', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('stopped', result.A.output.result);
            done();
        });

        control.stop({
            result: 'stopped'
        });
    });

    it('should cancel a single task gracefully with specific result', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('stopped', result.A.output.result);
            done();
        });

        control.stop({
            tasks: {
                A: {
                    result: 'stopped'
                }
            }
        });
    });

    it('should cancel two tasks gracefully with default results', function (done) {
        var tasks = {
            A: createNonMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: ['B']
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('A stopped', result.A.output.result);
            assert.equal('B stopped', result.B.output.result);
            done();
        });

        control.stop({
            tasks: {
                A: {
                    result: 'A stopped'
                },
                B: {
                    result: 'B stopped'
                }
            }
        });
    });

    it('should cancel two tasks, one gracefully and the other with default result', function (done) {
        var tasks = {
            A: createNonMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: ['B']
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('test error', result.A.err.message);
            assert.equal('B stopped', result.B.output.result);
            done();
        });

        control.stop({
            tasks: {
                A: {
                    err: new Error('test error')
                },
                B: {
                    result: 'B stopped'
                }
            }
        });
    });

    it('should cancel a single task gracefully, but with error', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(result.A.err);
            assert.equal('test error', result.A.err.message);
            done();
        });

        control.stop({
            tasks: {
                A: {
                    err: new Error('test error')
                }
            }
        });
    });

    it('should run two tasks cancel the last task, array dependencies', function (done) {
        var tasks = {
            A: createNonMappedTask('A', 500),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: [],
            B: []
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(result.A.err);
            assert.equal('test error', result.A.err.message);
            assert.ok(!result.B.err);
            done();
        });

        orc.loadTask('B').output.done(function (err, result) {
            control.stop(new Error('test error'));
        });
    });

    it('should run two tasks cancel the last task, map dependencies', function (done) {
        var tasks = {
            A: createMappedTask('A', 500),
            B: createMappedTask('B')
        };
        var orc = new Orchestrator({
            A: {},
            B: {}
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(result.A.err);
            assert.equal('test error', result.A.err.message);
            assert.ok(!result.B.err);
            done();
        });

        orc.loadTask('B').output.done(function (err, result) {
            control.stop(new Error('test error'));
        });
    });

    it('should run two tasks B->A and cancel the last task', function (done) {
        var tasks = {
            A: createNonMappedTask('A', 500),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: ['B']
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(result.A.err);
            assert.equal('test error', result.A.err.message);
            assert.ok(!result.B.err);
            done();
        });

        orc.loadTask('B').output.done(function (err, result) {
            control.stop(new Error('test error'));
        });
    });

    it('should run two tasks B->A and cancel the last task, map dependencies', function (done) {
        var tasks = {
            A: createMappedTask('A', 500),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: {
                data: 'B'
            }
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.ok(result.A.err);
            assert.equal('test error', result.A.err.message);
            assert.ok(!result.B.err);
            done();
        });

        orc.loadTask('B').output.done(function (err, result) {
            control.stop(new Error('test error'));
        });
    });

});

function _createTask(mapped, name, delay) {
    function exec(input, callback) {
        input.ctx.chain = input.ctx.chain || [];

        var inputData = mapped && Object.keys(input.dependencies || {}).map(function (paramName) {
            return input.dependencies[paramName];
        });

        async.parallel(inputData || [], function (err, results) {
            input.ctx.chain.push(name);
            setTimeout(callback.bind(null, null, {
                input: input,
                results: results
            }), delay || 0);           
        });
    }
    exec.id = name;
    return exec;    
}

var createMappedTask = _createTask.bind(null, true);
var createNonMappedTask = _createTask.bind(null, false);
