'use strict';

var assert = require('assert');

var async = require('async');

var Orchestrator = require('../lib/orchestrator').Orchestrator;
var index = require('../lib');

describe(__filename, function () {

    beforeEach(function () {
        require('../lib/orchestrator').reset();
    });

    it('should fail to run task', function (done) {
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
            }
        });

        orc.start({
            foo: 'bar'
        }).on('A', function (err, result) {
            assert.ok(err);
            assert.equal('Task A cannot be found', err.message);
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
        }).get('A', function (err, result) {
            assert.ok(!err);
            assert.equal('bar', result.input.ctx.foo);
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

        var output = orc.start({
            foo: 'bar'
        });

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            }
        ], done);
    });

    it('should run two tasks, one depends on the other', function (done) {
        var tasks = {
            A: createMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: {
                '@in': {
                    data: 'B'
                }
            },
            B: ''
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var ctx = {
            foo: 'bar'
        };
        var output = orc.start(ctx);

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            }
        ], function (err) {
            assert.ok(!err);
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

        var output = index.create({
            A: {
                '@in': {
                    dataB: 'B',
                    dataC: 'C'
                }
            },
            B: {
                '@in': {
                    dataC: 'C'
                }
            },
            C: [],
            D: {
                '@in': {
                    dataA: 'A',
                    dataB: 'B'
                }
            }
        }, {
            load: function load(name) {
                return tasks[name];
            }
        }).start(ctx);

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            },
            function (next) {
                output.get('C', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            },
            function (next) {
                output.get('D', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('bar', data.input.ctx.foo);
                    next();
                });
            }
        ], function (err) {
            assert.ok(!err);
            assert.equal('C->B->A->D', ctx.chain.join('->'));

            done();
        });

    });

    it('should cancel orchestrartor', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator(['A'], {
            load: function load(name) {
                return execFunc;
            }
        });

        orc
        .on('error', function (err) {
            assert.ok(/tried to publish after complete event/.test(err.message));
        })
        .start({
            foo: 'bar'
        }).on('A', function (err, result) {
            assert.ok(err);
            assert.equal('test error', err.message);
            done();
        }).stop(new Error('test error'));
    });

    it('should cancel a single task', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator(['A'], {
            load: function load(name) {
                return execFunc;
            }
        });

        orc
        .on('error', function (err) {
            assert.ok(/tried to publish after complete event/.test(err.message));
        })
        .start({
            foo: 'bar'
        }).on('A', function (err, result) {
            if (err) {
                assert.ok(err);
                assert.equal('test error', err.message);
                done();
            }
        }).task('A').stop(new Error('test error'));
    });

    it('should cancel orchestrator gracefully with default result for all tasks', function (done) {
        var execFunc = createNonMappedTask('A');
        var orc = new Orchestrator({
            A: []
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var control = orc
        .on('error', function (err) {
            assert.ok(/tried to publish after complete event/.test(err.message));
        })
        .start({
            foo: 'bar'
        })
        .on('*', function (err, data) {
            assert.ok(!err);
            assert.equal('stopped', data.result);
            done();
        });

        control.stop({
            result: 'stopped'
        });
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

        var control = orc
        .on('error', function (err) {
            assert.ok(/tried to publish after complete event/.test(err.message));
        })
        .start({
            foo: 'bar'
        })
        .on('A', function (err, data) {
            assert.ok(!err);
            if (data.result) {
                // waiting for the right data to come
                assert.equal('stopped', data.result);
                done();
            }
        });

        control.task('A').stop({
            result: 'stopped'
        });
    });

    it('should cancel two tasks gracefully with default results', function (done) {
        var tasks = {
            A: createNonMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: ['B'],
            B: ''
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.tolerant(true).start({
            foo: 'bar'
        });

        async.series([
            function (next) {
                control.get('A', function (err, data) {
                    assert.ok(!err);
                    if (data.result) {
                        assert.equal('A stopped', data.result);
                        next();
                    }
                });
            },
            function (next) {
                control.get('B', function (err, data) {
                    assert.ok(!err);
                    if (data.result) {
                        assert.equal('B stopped', data.result);
                        next();
                    }
                });
            }
        ], done);

        control.task('A').stop({
            result: 'A stopped'
        }).task('B').stop({
            result: 'B stopped'
        });
    });

    it('should cancel two tasks, one gracefully and the other with default result', function (done) {
        var tasks = {
            A: createNonMappedTask('A'),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: ['B'],
            B: ''
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        });

        async.series([
            function (next) {
                control.get('A', function (err, data) {
                    if (err) {
                        assert.equal('test error', err.message);
                        next();
                    }
                });
            },
            function (next) {
                control.get('B', function (err, data) {
                    assert.ok(!err);
                    if (data.result) {
                        assert.equal('B stopped', data.result);
                        next();
                    }
                });
            }
        ], done);

        control
        .task('A').stop(new Error('test error'))
        .task('B').stop({
            result: 'B stopped'
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
        });

        async.series([
            function (next) {
                control.get('A', function (err, data) {
                    if (err) {
                        assert.equal('test error', err.message);
                        next();
                    }
                });
            },
            function (next) {
                control.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.ok(data.input);
                    next();
                });
            }
        ], done);

        control.task('A').stop(new Error('test error'));
    });

    it('should run two tasks B->A and cancel the last task', function (done) {
        var tasks = {
            A: createNonMappedTask('A', 500),
            B: createNonMappedTask('B')
        };
        var orc = new Orchestrator({
            A: ['B'],
            B: ''
        }, {
            load: function load(name) {
                return tasks[name];
            }
        });

        var control = orc.start({
            foo: 'bar'
        });

        async.series([
            function (next) {
                control.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.ok(data.input);
                    next();
                });
            },
            function (next) {
                control.get('B', function (err, data) {
                    if (err) {
                        assert.equal('test error', err.message);
                        next();
                    }
                });
            }
        ], done);

        control.task('B').stop(new Error('test error'));
    });

});

function _createTask(mapped, name, delay) {
    function exec(input, output) {
        input.ctx.chain = input.ctx.chain || [];

        var inputData = (input.getInputNames() || []).map(function (paramName) {
            return function (next) {
                input.get(paramName, next);
            };
        });

        async.parallel(inputData || [], function (err, results) {
            input.ctx.chain.push(name);

            setTimeout(function () {
                output.set({
                    input: input,
                    results: results
                });
            }, delay || 0);
        });
    }
    exec.id = name;
    return exec;
}

var createMappedTask = _createTask.bind(null, true);
var createNonMappedTask = _createTask.bind(null, false);
