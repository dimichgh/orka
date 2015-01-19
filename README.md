orka
====

The module provides configuration based task management.

The module functionality is different from other modules that provide similar API, such as async or orchestrator. The main difference is how a task is executed in relation to the tasks it depends on. For example, if task A depends on tasks C and D, it will be executed only when tasks C and D are complete while orka will let A run till it really needs results from C or D. If it happens due to logic that task A does not need data from D or C it will run without waiting for the related tasks.

# Installation

```
npm install orka --save
```

# Configuration

The configuration is based on one level of dependency tree, meaning each task specifies only direct dependencies. For example:

## Execution plan

```javascript
var plan = {
    A: {
        dataFromB: 'B',
        dataFromC: 'C'
    },
    B: {
        dataFromC: 'C'
    },
    D: {
        dataFromA: 'A',
        dataFromB: 'B'
    }
};
```

## Task loading

The tasks are loaded via options.loader:
```javascript
var orka = require('orka');
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    console.log(results.A.err);
    console.log(results.A.output);
});
```

## Task signature

The task is expected to have the following execution API:
```javascript
function task(input, callback) {
    // context shared between tasks
    var ctx = input.ctx;
    // getting data from dependency task
    var getData = input.dataFromTaskX;
    // waiting for data
    getData(function (err, data) {
        // process data
        // do task own processing
        // complete the task
        callback(err, results);
    });
}
```

## Examples

Single task execution
```javascript
var orka = require('orka');
var executionPlan = {
    A: {}
};
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    console.log(results.A.err);
    console.log(results.A.output);
});
```

Two independent tasks
```javascript
var orka = require('orka');
var executionPlan = {
    A: {},
    B: {}
};
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    console.log(results.A.err);
    console.log(results.A.output);
    console.log(results.B.err);
    console.log(results.B.output);
});
```

Two dependent tasks
```javascript
var orka = require('orka');
var executionPlan = {
    A: {
        dataFromB: 'B'
    }
};
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    console.log(results.A.err);
    console.log(results.A.output);
    console.log(results.B.err);
    console.log(results.B.output);
});
// example of task A that depends on B
function taskA(input, callback) {
    input.dataFromB(function (err, data) {
        // do some data process for task B results
        // complete task A
        callback(err, {
            // some results from task A and B
        });
    });
}
```

You can also cancel tasks in case they take too much time. The tasks that has already been completed will contain results.
```javascript
var orka = require('orka');
var executionPlan = {
    A: {
        dataFromB: 'B'
    }
};
var control = orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    console.log(results.A.err);
    console.log(results.A.output);
    console.log(results.B.err);
    console.log(results.B.output);
});

control.stop(new Error('The tasks has been canceled'));
```

You can cancel tasks gracefully, with default result.
```javascript
var orka = require('orka');
var executionPlan = {
    A: {
        dataFromB: 'B'
    }
};
var control = orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    console.log(results.A.err);
    console.log(results.A.output);
    console.log(results.B.err);
    console.log(results.B.output);
});

control.stop({
    tasks: {
        A: {
            result: (default result for A)
        },
        B: {
            result: (default result for B)
        }
    }
});
```

# Maintainers

* [Dmytro Semenov](https://github.com/dimichgh)

# License

Apache License v2.0