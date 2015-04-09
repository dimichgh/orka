'use strict';

var assert = require('assert');

var async = require('async');

var Orchestrator = require('../lib/orchestrator').Orchestrator;

describe(__filename, function () {

    beforeEach(function () {
        require('../lib/orchestrator').reset();
    });

    it('should fail to load task', function (done) {
        var orc = new Orchestrator(undefined, {
            load: function load(name) {
            }
        });

        var task = orc.loadTask('A');
        assert.ok(task);
        assert.ok(typeof task === 'function');
        orc.run('A', task).get('A', function (err, data) {
            assert.ok(err);
            assert.equal('Task A cannot be found', err.message);
            done();
        });
    });

    it('should load task with empty array props', function (done) {
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

        // make sure it is cached
        var task2 = orc.loadTask('A');
        assert.equal(task, task2);

        orc.run(task).get('A', function (err, data) {
            assert.ok(!err, err && err.stack);
            assert.equal('input', data);
            done();
        });
    });

    it('should load task with empty map props', function (done) {
        var execFunc = createTask('A');
        var orc = new Orchestrator({
            A: {}
        }, {
            load: function load(name) {
                return execFunc;
            }
        });

        var task = orc.loadTask('A');
        assert.ok(task);

        // make sure it is cached
        var task2 = orc.loadTask('A');
        assert.equal(task, task2);

        orc.run(task).get('A', function (err, data) {
            assert.ok(!err);
            assert.equal('input', data);
            done();
        });
    });

    it('should load 2 dependent tasks', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B')
        };

        var output = new Orchestrator({
            A: 'B',
            B: []
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        }).start();

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            }
        ]);

    });

    it('should load 2 tasks', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B')
        };

        var output = new Orchestrator({
            A: [],
            B: []
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        }).start();

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            }
        ]);
    });

    it('should load 2 tasks with mapped dependencies', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B')
        };

        var output = new Orchestrator({
            A: {},
            B: {}
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        }).start();

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            }
        ]);
    });

    it('should load 3 tasks', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B'),
            C: createTask('C')
        };

        var output = new Orchestrator({
            A: ['B'],
            B: ['C'],
            C: ''
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        }).start();

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('C', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            }
        ]);
    });

    it('should load 3 tasks, mapped dependencies', function () {
        var execFuncs = {
            A: createTask('A'),
            B: createTask('B'),
            C: createTask('C')
        };

        var output = new Orchestrator({
            A: {
                "@in": {
                    "inB": "B"
                }
            },
            B: ['C'],
            C: undefined
        }, {
            load: function load(name) {
                return execFuncs[name];
            }
        }).start();

        async.series([
            function (next) {
                output.get('A', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('C', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            },
            function (next) {
                output.get('B', function (err, data) {
                    assert.ok(!err);
                    assert.equal('input', data);
                    next();
                });
            }
        ]);
    });

});

function createTask(name) {
    function execFunc(input, output) {
        output.set('input');
    }
    execFunc.id = name;
    return execFunc;
}
