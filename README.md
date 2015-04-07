orka
====

The module provides configuration based task management.

The module functionality is different from other modules that provide similar API, such as async or orchestrator. The main difference is how a task is executed in relation to the tasks it depends on. For example, if task A depends on tasks C and D, it will be executed only when tasks C and D are complete while orka may let A run till it really needs results from C or D. If it happens due to logic that task A does not need data from D or C it would run without waiting for the related tasks (mapped dependency).

The communication between tasks is done via cachable callbacks based on publisher/subscriber pattern. The task that needs data from other tasks, subscribes to the specific topics by declaring them in its task 'in' dependencies. The output (task 'out' section) is always single result that can be published to multiple topics. If one wants to split the output into multiple publish topics, one can use separate tasks to subscribe and process/format them into a separate topic.

# Installation

```
npm install orka --save
```

# Configuration

The configuration is called 'execution plan' and is based on one level of dependency tree, meaning each task specifies only direct dependencies.

## Task

The task is simple unit of execution.

Propeties:
 * 'in' specifies topics that the task may listen to.
    * in case 'in' is missing, it is considered a leaf task without any dependencies on other topics.
 * 'out' specifies the topics it will publish results to.
    * in case 'out' is missing, it will publish under its name.
 * 'error' specifies the topics it will publish error in case of error.
    * in case the property is missing, it will publish under 'out' topic.
 * 'if' specifies the topics the task will wait publishing to before starting the execution

Behaviors:
 * task is started immediately unless 'if' is specified.
 * can publish multiple times to the topics.
 * can receive multiple events from topics subsrcibed.

## Execution plan

Simple example:
```javascript
var plan = {
    A: ['B', 'C'],
    B: ['C'],
    D: ['A', 'B']
};
```

In the above example, each task would publish the result under its name unless explicit name specified.
So, if we have A: ['B'] it would use for data from topic 'B' and publish the results under topic 'A'.

Example of task publishing to specific topic:
```javascript
var plan = {
    A: {
        @in: ['B', 'C'],
        @out: 'topic'
    }
};
// OR
var plan = {
    A: {
        @in: ['B', 'C'],
        @out: ['topic1', 'topic2']
    }
};
```

### Mapping topics to input parameters

In the below example task A uses two parameters 'inputB' and 'inputC' to get data. The parameters mapped to topic 'B' and topic 'C' accordingly.
```javascript
var plan = {
    A: {
        @in: {
            'inputB': 'B',
            'inputC': 'C'
        },
        @out: 'topic'
    }
};
```

### Conditional execution

Unless explicitly specified, the task would execute immediately. To delay task execution one can use 'if' section that would listen to the specific topics to complete, before the task can be executed.
```javascript
var plan = {
    A: {
        @if: ['D', 'B'],
        @in: ['B', 'C'],
        @out: 'A'
    }
};
```
In the above example A will task for two topics to get published and then it will start executing. Once running it would expect data from two other topics in 'in' section of the task. The result will be published under topic 'A'

### Caching example

#### Task without caching
The task A uses result from task B.
```javascript
var plan = {
    A: {
        @in: 'TOPIC'
    },
    B: {
        @out: 'TOPIC'
    }
};
```

#### Series execution
This will execute tasks sequentially.
```javascript
var plan = {
    A: [],
    B: { @if: 'A' }
    C: { @if: 'B' }
}

// Or simpler form which will execute tasks and each task will publish results under its name
var plan = {
    @series: [A, B, C]
};
// Or this will execute a series of tasks sequentially and publish to common topic as well as to the task specified topics
var plan = {
    @series: {
        A: {
            @out: 'TOPIC_A'
        },
        B: {
            @out: 'TOPIC_B'
        },
        C: {
            @out: 'TOPIC_C'
        },
        @out: 'TOPIC'
    }
};
// Or this will execute the tasks and publish each result under 'TOPIC' as well as nuder tasks names
var plan = {
    @series: {
        @run: [A, B, C],
        @out: 'TOPIC'
    }
};
```

#### First execution
Will sequentially execute tasks one after the other till one publishes result that is not undefined.
```javascript
var plan = {
    @first: [A, B, C]
};
```
This one can be used for cache fallback
```javascript
var plan = {
    A: {
        @in: 'TOPIC'
    },
    @first: {
        @run: [B, C],
        @out: 'TOPIC'
    }
};
```

## Task loading

Given the following execution plan
```javascript
var plan = {
    A: {
        @in: {
            'input': 'TOPIC',
        }
    },
    @first: {
        @run: [B, C],
        @out: 'TOPIC'
    }
};
```

The tasks can be loaded via options.load function or require by default:
```javascript
var orka = require('orka');
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, output) {
    output.get('A', function (err, result) {
        console.log('Task A err:', err);
        console.log('Task A result:', result);
    });
    output.get('B', function (err, result) {
        console.log('Task B err:', err);
        console.log('Task B result:', result);
    });
    output.get('C', function (err, result) {
        console.log('Task C err:', err);
        console.log('Task C result:', result);
    });
    output.get('TOPIC', function (err, result) {
        console.log('TOPIC err:', err);
        console.log('TOPIC result:', result);
    });
});
```

## Task API

The task is expected to have the following execution API:
```javascript
function taskA(input, callback) {
    // waiting for data
    input.get('input', function(err, result) {
        // handle input data
        callback(err, result);
    });
}
```

## Examples

Single task execution
```javascript
var orka = require('orka');
var executionPlan = {
    A: []
};
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    results.get('A', function (err, result) {
        console.log('Task A err:', err);
        console.log('Task A result:', result);
    });
});
```

Two independent tasks
```javascript
var orka = require('orka');
var executionPlan = ['A', 'B'];
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    results.get('A', function (err, result) {
        console.log('Task A err:', err);
        console.log('Task A result:', result);
    });
    results.get('B', function (err, result) {
        console.log('Task B err:', err);
        console.log('Task B result:', result);
    });
});
```

Two dependent tasks
```javascript
var orka = require('orka');
var executionPlan = {
    A: {
        @in: {
            data: 'B'
        }
    }
};
orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    results.get('A', function (err, result) {
        console.log('Task A err:', err);
        console.log('Task A result:', result);
    });
    results.get('B', function (err, result) {
        console.log('Task B err:', err);
        console.log('Task B result:', result);
    });
});
// example of task A that depends on B
function taskA(input, callback) {
    inputget('data', function (err, data) {
        // do some data process for task B results
        // complete task A
        callback(err, {
            // some results from task A and B
        });
    });
}
```

You can also cancel tasks in case they take too much time. The tasks that have already been completed will contain results.
```javascript
var orka = require('orka');
var executionPlan = {
    A: ['B']
};
var control = orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    results.get('A', function (err, result) {
        console.log('Task A err:', err);
        console.log('Task A result:', result);
    });
    results.get('B', function (err, result) {
        console.log('Task B err:', err);
        console.log('Task B result:', result);
    });
});

control.stop(new Error('The tasks has been canceled'));
```

You can cancel tasks gracefully, with default result.
```javascript
var orka = require('orka');
var executionPlan = {
    A: ['B']
};
var control = orka.start(executionPlan, {
    load: function (taskName) {
        return someRegistry[taskName];
    }
}, function (err, results) {
    results.get('A', function (err, result) {
        console.log('Task A err:', err);
        console.log('Task A result:', result);
    });
    results.get('B', function (err, result) {
        console.log('Task B err:', err);
        console.log('Task B result:', result);
    });
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

From the above API you can see that you can cancel specific tasks while the rest will still run.
```javascript
control.stop({
    tasks: {
        A: {
            err: new Error('Only task A has been stopped')
        }
    }
});
```

# Maintainers

* [Dmytro Semenov](https://github.com/dimichgh)

# License

Apache License v2.0
