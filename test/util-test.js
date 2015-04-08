'use strict';

var assert = require('assert');
var utils = require('../lib/utils');

describe(__filename, function () {

    it('should normalize simple task, params null', function () {
        assert.deepEqual([{'name':'A'}], utils.normalizePlan({
            A: null
        }));
    });

    it('should normalize simple task, params are empty string', function () {
        assert.deepEqual([{'name':'A'}], utils.normalizePlan({
            A: ''
        }));
    });

    it('should normalize simple task, params undefined', function () {
        assert.deepEqual([{'name':'A'}], utils.normalizePlan({
            A: undefined
        }));
    });

    it('should normalize simple task', function () {
        assert.deepEqual([{'name':'A'}], utils.normalizePlan({
            A: []
        }));
    });

    it('should normalize simple task with @out', function () {
        assert.deepEqual([{'name':'A','out':{'topic':'topic'}}], utils.normalizePlan({
            A: {
                '@out': 'topic'
            }
        }));
    });

    it('should normalize simple task with @out, array of one topic', function () {
        assert.deepEqual([{'name':'A','out':{'topic':'topic'}}], utils.normalizePlan({
            A: {
                '@out': ['topic']
            }
        }));
    });

    it('should normalize simple task with @out, array of multiple topics', function () {
        assert.deepEqual([{'name':'A','out':{'T1':'T1','T2':'T2'}}], utils.normalizePlan({
            A: {
                '@out': ['T1', 'T2']
            }
        }));
    });

    it('should normalize simple task with @out, topic mapped', function () {
        assert.deepEqual([{'name':'A','out':{'out1':'T1'}}], utils.normalizePlan({
            A: {
                '@out': {
                    out1: 'T1'
                }
            }
        }));
    });

    it('should normalize simple task with @out, multiple topics mapped', function () {
        assert.deepEqual([{'name':'A','out':{'out1':'T1','out2':'T2'}}], utils.normalizePlan({
            A: {
                '@out': {
                    out1: 'T1',
                    out2: 'T2'
                }
            }
        }));
    });

    it('should normalize simple task with @if', function () {
        assert.deepEqual([{'name':'A','if':['T1']}], utils.normalizePlan({
            A: {
                '@if': 'T1'
            }
        }));
    });

    it('should normalize simple task with @if, multiple topics', function () {
        assert.deepEqual([{'name':'A','if':['T1','T2']}], utils.normalizePlan({
            A: {
                '@if': ['T1', 'T2']
            }
        }));
    });

    it('should normalize simple task with @if and @in attributes', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'},'if':['T1']}], utils.normalizePlan({
            A: {
                '@if': 'T1',
                '@in': 'B'
            }
        }));
    });

    it('should normalize simple task with all attributes', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'},'if':['T1'],'out':{'T2':'T2'}}], utils.normalizePlan({
            A: {
                '@if': 'T1',
                '@in': 'B',
                '@out': 'T2'
            }
        }));
    });

    it('should normalize two tasks', function () {
        assert.deepEqual([{'name':'A'},{'name':'B'}], utils.normalizePlan({
            A: [],
            B: []
        }));
    });

    it('should normalize two tasks, as array', function () {
        assert.deepEqual([{'name':'A'},{'name':'B'}], utils.normalizePlan(['A', 'B']));
    });

    it('should normalize task with dependency', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'}}], utils.normalizePlan({
            A: 'B'
        }));
    });

    it('should normalize task with array dependency', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'}}], utils.normalizePlan({
            A: ['B']
        }));
    });

    it('should normalize task with @in dependency', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'}}], utils.normalizePlan({
            A: {
                '@in': 'B'
            }
        }));
    });

    it('should normalize task with @in dependency as array', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'}}], utils.normalizePlan({
            A: {
                '@in': ['B']
            }
        }));
    });

    it('should normalize task with @in dependency as map', function () {
        assert.deepEqual([{'name':'A','in':{'inputB':'B'}}], utils.normalizePlan({
            A: {
                '@in': {
                    inputB: 'B'
                }
            }
        }));
    });

    it('should normalize task with multiple dependencies', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B','C':'C'}}], utils.normalizePlan({
            A: ['B', 'C']
        }));
    });

    it('should normalize task with multiple dependencies in @in', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B','C':'C'}}], utils.normalizePlan({
            A: {
                '@in': ['B', 'C']
            }
        }));
    });

    it('should normalize task with multiple dependencies in @in as a map', function () {
        assert.deepEqual([{'name':'A','in':{'inputB':'B','inputC':'C'}}], utils.normalizePlan({
            A: {
                '@in': {
                    'inputB': 'B',
                    'inputC': 'C'
                }
            }
        }));
    });

    it('should normalize tasks with dependencies', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'}},{'name':'B','in':{'C':'C'}}], utils.normalizePlan({
            A: 'B',
            B: 'C'
        }));
    });

    it('should normalize tasks with dependencies as arrays', function () {
        assert.deepEqual([{'name':'A','in':{'B':'B'}},{'name':'B','in':{'C':'C'}}], utils.normalizePlan({
            A: ['B'],
            B: ['C']
        }));
    });

    it('should normalize tasks with multiple dependencies in @in as a map', function () {
        assert.deepEqual([{'name':'A','in':{'inputB':'B','inputC':'C'}},{'name':'B','in':{'C':'C'}}], utils.normalizePlan({
            A: {
                '@in': {
                    'inputB': 'B',
                    'inputC': 'C'
                }
            },
            B: 'C'
        }));
    });

    it('should not detect circular dependency with @out', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "@out": "A"
                }
            });
            done();
        }
        catch (err) {
            done(new Error('should not fail'));
        }
    });

    it('should normalize plan dependencies', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@in": "T1",
                "@out": "T1"
            }
        });
        assert.deepEqual({"A":{"@in":"T1","@out":"T1"},"T1":["A"]}, plan);
    });

    it('should normalize plan dependencies, @out is array of one topic', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@in": "T1",
                "@out": ["T1"]
            }
        });
        assert.deepEqual({"A":{"@in":"T1","@out":["T1"]},"T1":["A"]}, plan);
    });

    it('should normalize plan dependencies, @out is array multiple topics', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@in": "T1",
                "@out": ["T1", "T2"]
            }
        });
        assert.deepEqual({"A":{"@in":"T1","@out":["T1", "T2"]},"T1":["A"],"T2":["A"]}, plan);
    });

    it('should normalize plan dependencies, @out is map of one topic', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@in": "T1",
                "@out": {
                    "t1": "T1"
                }
            }
        });
        assert.deepEqual({"A":{"@in":"T1","@out":{"t1":"T1"}},"T1":["A"]}, plan);
    });

    it('should normalize plan dependencies, @out is map of multiple topics', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@in": "T1",
                "@out": {
                    "t1": "T1",
                    "t2": "T2"
                }
            }
        });
        assert.deepEqual({"A":{"@in":"T1","@out":{"t1":"T1","t2":"T2"}},"T1":["A"],"T2":["A"]}, plan);
    });

    it('should normalize plan dependencies for two tasks, same topics', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@out": "T1"
            },
            "B": {
                "@out": "T1"
            }
        });
        assert.deepEqual({"A":{"@out":"T1"},"B":{"@out":"T1"},"T1":["A","B"]}, plan);
    });

    it('should normalize plan dependencies for two tasks, mixed topics', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@out": "T1"
            },
            "B": {
                "@out": ["T1", "T2"]
            }
        });
        assert.deepEqual({"A":{"@out":"T1"},"B":{"@out":["T1","T2"]},"T1":["A","B"],"T2":["B"]}, plan);
    });

    it('should normalize plan dependencies for two tasks, mixed topics, map', function () {
        var plan = utils.normalizePlanDependencies({
            "A": {
                "@out": {
                    "t1": "T1"
                }
            },
            "B": {
                "@out": ["T1", "T2"]
            }
        });
        assert.deepEqual({"A":{"@out":{"t1":"T1"}},"B":{"@out":["T1","T2"]},"T1":["A","B"],"T2":["B"]}, plan);
    });

    it('should detect circular dependency with @out and @in', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "@in": "T1",
                    "@out": "T1"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->T1->A', err.message);
            done();
        }
    });

    it('should detect circular dependency, long trace', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "@in": "T3",
                    "@out": "T1"
                },
                "B": {
                    "@if": "T1",
                    "@out": {
                        "t2": "T2"
                    }
                },
                "C": {
                    "@in": "T2",
                    "@out": "T3"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->T3->C->T2->B->T1->A', err.message);
            done();
        }
    });

    it('should detect circular dependency with @out and @in with two tasks', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "@in": "T1",
                    "@out": "T1"
                },
                "B": {
                    "@out": "T1"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->T1->A', err.message);
            done();
        }
    });

    it('should detect simple circular dependency', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "@in": "A"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->A', err.message);
            done();
        }
    });

    it('should detect simple circular array dependency', function (done) {
        try {
            utils.validatePlan({
                "A": ["A"]
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->A', err.message);
            done();
        }
    });

    it('should detect circular dependency', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "@in": "B"
                },
                "B": {
                    "@in": "A"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->A', err.message);
            done();
        }
    });

    it('should detect complex circular dependency', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in": "B"
                },
                "B": {
                    "in": "C"
                },
                "C": {
                    "in": "D"
                },
                "D": {
                    "in": "B"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->C->D->B', err.message);
            done();
        }
    });

    it('should detect complex circular dependency 2', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in1": "B",
                    "in2": "C"
                },
                "B": {
                    "in": "C"
                },
                "C": {
                    "in": "D"
                },
                "D": {
                    "in": "B"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->C->D->B', err.message);
            done();
        }
    });

    it('should detect complex circular dependency 3', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in1": "B",
                    "in2": "C"
                },
                "B": {
                    "in1": "C",
                    "in2": "D"
                },
                "C": {
                    "in": "D"
                },
                "D": {
                    "in": "B"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->C->D->B', err.message);
            done();
        }
    });

    it('should not detect circular dependency', function (done) {
        utils.validatePlan({
            "A": {}
        });
        done();
    });

    it('should not detect circular dependency 1', function (done) {
        utils.validatePlan({
            "A": {
                "in": "B"
            }
        });
        done();
    });

    it('should not detect circular dependency 2', function (done) {
        utils.validatePlan({
            "A": {
                "in": "B"
            },
            "B": {
                "in": "C"
            }
        });
        done();
    });

    it('should not detect circular dependency 3', function (done) {
        utils.validatePlan({
            "A": {
                "in1": "B",
                "in2": "C"
            },
            "B": {
                "in": "C"
            }
        });
        done();
    });
});

describe('hashes', function () {
    var str = 'some long string, quyruier ewejrhwkrjw rwekjhrwekr wekrhwe rhwekrhw kwehr w';

    it('should calculate string hash', function () {
        for (var i = 0; i < 100000; i++) {
            utils.stringHash(str);
        }
    });

    it('should calculate hash from string', function () {
        for (var i = 0; i < 100000; i++) {
            utils.hash(str);
        }
    });
});
