'use strict';

var assert = require('assert');

var async = require('async');

var Task = require('../lib/tasks').Task;

describe(__filename, function () {

    it('should execute task', function (done) {
        var task = new Task('A', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-data', input.data);
            callback(null, input);
        });

        task.input.data = 'test-data';

        var count = 0;
        function end() {
            if (++count === 2) {
                done();
            }
        }
        task.output.done(function (err, result) {
            assert.ok(!err);
            assert.equal('test-data', result.data);
            end();
        });

        task.run({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('test-data', result.data);
            end();
        });
    });

    it('should report error', function (done) {
        var task = new Task('A', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-data', input.data);
            callback(new Error('test error'));
        });

        task.input.data = 'test-data';

        var count = 0;
        function end() {
            if (++count === 2) {
                done();
            }
        }
        task.output.done(function (err, result) {
            assert.ok(err);
            assert.equal('test error', err.message);
            end();
        });

        task.run({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(err);
            assert.equal('test error', err.message);
            end();
        });
    });

    it('should cancel task with error', function (done) {
        var task = new Task('A', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-data', input.data);
            setTimeout(function () {
                callback(null, input);
            }, 500);
        });

        task.input.data = 'test-data';

        var count = 0;
        function end() {
            if (++count > 1) {
                done();
            }
        }
        task.output.done(function (err, result) {
            assert.ok(err);
            assert.equal('test error', err.message);
            end();
        });

        task.run({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(err);
            assert.equal('test error', err.message);
            end();
        });

        task.cancel(new Error('test error'));
        // simulate double cancel
        task.cancel(new Error('test error 2'));
    });


    it('should cancel task with default result', function (done) {
        var task = new Task('A', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-data', input.data);
            setTimeout(function () {
                callback(null, input);
            }, 500);
        });

        task.input.data = 'test-data';

        var count = 0;
        function end() {
            if (++count === 2) {
                done();
            }
        }
        task.output.done(function (err, result) {
            assert.ok(!err);
            assert.equal('ok', result.data);
            end();
        });

        task.run({
            foo: 'bar'
        }, function (err, result) {
            assert.ok(!err);
            assert.equal('ok', result.data);
            end();
        });

        task.cancel(null, {
            data: 'ok'
        });
        // simulate double cancel
        task.cancel(null, {
            data: 'ok2'
        });
    });

    it('should execute task with dependency', function (done) {
        var taskA = new Task('A', function exec(input, callback) {
            var self = this;
            // wait for data from B
            input.B(function (err, result) {
                assert.equal('test-dataB', result.data);
                assert.equal('bar', input.ctx.foo);
                assert.equal('test-dataA', input.data);
                callback(null, input);
            });
        });

        var taskB = new Task('B', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-dataB', input.data);
            setTimeout(callback.bind(null, null, input), 500);
        });

        taskA.addDependency('B', taskB);

        taskA.input.data = 'test-dataA';
        taskB.input.data = 'test-dataB';

        var ctx = {
            foo: 'bar'
        };

        taskA.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal('test-dataA', result.data);
            done();
        });

        taskB.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal('test-dataB', result.data);
        });

    });

    it('should execute tasks with dependencies', function (done) {
        var chain = [];
        var taskA = new Task('A', function exec(input, callback) {
            var self = this;

            assert.equal('test-dataA', input.data);
            assert.equal('bar', input.ctx.foo);

            async.parallel([
                function onB(cb) {
                    // wait for data from B
                    input.B(function (err, result) {
                        assert.ok(!err);
                        assert.equal('data-B', result);
                        cb(null, result);
                    });
                },
                function onC(cb) {
                    // wait for data from B
                    input.C(function (err, result) {
                        assert.ok(!err);
                        assert.equal('data-C', result);
                        cb(null, result);
                    });
                }
            ], function(err, results) {
                chain.push('A');
                callback(err, {
                    B: results[0],
                    C: results[1]
                });
            });
        });

        var taskB = new Task('B', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-dataB', input.data);
            chain.push('B');
            setTimeout(callback.bind(null, null, 'data-B'), 500);
        });

        var taskC = new Task('C', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-dataC', input.data);
            chain.push('C');
            setTimeout(callback.bind(null, null, 'data-C'), 100);
        });

        var taskD = new Task('D', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-dataD', input.data);

            input.A(function (err, result) {
                assert.ok(!err);
                chain.push('D');
                callback(null, {
                    A: result
                });
            });
        });

        taskA.addDependency('B', taskB);
        taskA.addDependency('C', taskC);
        taskD.addDependency('A', taskA);

        taskA.input.data = 'test-dataA';
        taskB.input.data = 'test-dataB';
        taskC.input.data = 'test-dataC';
        taskD.input.data = 'test-dataD';

        var ctx = {
            foo: 'bar'
        };

        taskD.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal(JSON.stringify({'A':{'B':'data-B','C':'data-C'}}), JSON.stringify(result));
            assert.equal('C->B->A->D', chain.join('->'));
            done();
        });

        taskA.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal(JSON.stringify({'B':'data-B','C':'data-C'}), JSON.stringify(result));
        });

        taskC.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal('data-C', result);
        });

        taskB.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal('data-B', result);
        });

    });

    it('should execute task with dependency and get canceled with error', function (done) {
        var taskA = new Task('A', function exec(input, callback) {
            var self = this;
            // wait for data from B
            input.B(function (err, result) {
                assert.ok(err);
                assert.equal('test error', err.message);
                callback(null, input);
            });
        });

        var taskB = new Task('B', function exec(input, callback) {
            assert.equal('bar', input.ctx.foo);
            assert.equal('test-dataB', input.data);
            setTimeout(callback.bind(null, null, input), 500);
        });

        taskA.addDependency('B', taskB);

        taskA.input.data = 'test-dataA';
        taskB.input.data = 'test-dataB';

        var ctx = {
            foo: 'bar'
        };

        taskA.run(ctx, function (err, result) {
            assert.ok(!err);
            assert.equal('test-dataA', result.data);
            done();
        });

        taskB.run(ctx, function (err, result) {
            assert.ok(err);
        });

        taskB.cancel(new Error('test error'));

    });

});