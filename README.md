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
 * '@in' specifies topics that the task may listen to.
    * in case 'in' is missing, it is considered a leaf task without any dependencies on other topics.
 * '@out' specifies the topics it will publish results to.
    * in case 'out' is missing, it will publish under its name.
 * '@after' specifies the topics the task will wait for before starting the execution.

## API
The task is expected to have the following execution API:
```javascript
function taskA(input, output) {
    // waiting for data if needed
    input.get('input', function(err, result, complete) {
        // handle input data
        // publish result to output names
        if (err)
            output.set('error', new Error('Error'));
        else if (result)
            output.set('result', 'some result');
        else
            output.set('empty', 'default result');
    });
}
```

Behaviors:
 * task is started immediately unless '@after' is specified.
 * can publish multiple times to the topics.
 * different tasks can publish to the same topic.
 * can receive multiple events from topics subscribed.
 * task never directly depends on the other, only via TOPIC

## Execution plan

There are a few use cases:
* Task A does not depend on task B and both will start and execute in parallel
* Task A directly depends on task B and will first execute task B and wait for completion before starting. This is useful for example to implement caching where one does not want to start expensive call before cache is found to have no data.
* Task A does not directly dependds on task B, but will use data published by task B, both will start and if A needs data published by B it will go into callback waiting at some point.

* One task
```javascript
// A will publish results under topic 'A'
var plan = ['A'];
// or A will publish results under topic 'topicA'
var plan = {
    A: {
        @out: 'topicA'
    }
}
// or multiple topics
var plan = {
    A: {
        @out: ['topicA', 'topicA+']
    }
}
// decoupling by mapping output to specific topics
var plan = {
    A: {
        @out: {
            result: 'topicA',
            error: 'topicA-error'
        }
    }
}
```

* Two parallel tasks
```javascript
// these will execute in parallel and publish results under topics 'A' and 'B'
var plan = ['A', 'B'];
// or with empty attributes
var plan = {
    A: {},
    B: {}
};
// or when A and B publishes to specific topics
var plan = {
    A: {
        @out: 'topicA'
    },
    B: {
        @out: ['topicB', 'topicB+']
    }
};
```

* Group of tasks, where one indirectly depends on other task via publishing to specific topics
```javascript
// B uses results from A
var plan = {
    B: 'A'
};
// or
var plan = {
    B: {
        @in: 'A'
    }
};
// or decoupling by mapping B to topic published by A
var plan = {
    B: {
        @in: 'topicA'
    }
    A: {
        @out: 'topicA'
    }
};
// or more decoupling by mapping input of B to topic of published by A
var plan = {
    B: {
        @in: {
            inputB: 'topicA'
        }
    }
    A: {
        @out: 'topicA'
    }
};
```

* Multiple dependencies
```javascript
// or C depends on A and B, i.e. uses data published under 'A' and 'B'
var plan = {
    C: ['A', 'B']
};
// or
var plan = {
    C: {
        @in: ['A', 'B']
    }
};
// or completely decoupling by mapping inputs to tasks topics
var plan = {
    C: {
        @in: {
            inputA: 'A',
            inputB: 'B'
        }
    }
};
// or even more decoupling by mapping inputs to defined topics
var plan = {
    C: {
        @in: {
            inputA: 'topicA',
            inputB: 'topicB'
        }
    },
    A: {
        @out: 'topicA'
    },
    B: {
        @out: 'topicB'
    }
};
```

* Mixed of parallel and series tasks
```javascript
var plan = {
    B: ['A', 'C'],
    C: ['A']
};
```

### Conditional execution with '@after'
Unless explicitly specified, the task would execute immediately. To delay task execution one can use 'after' section that would listen to the specific topics to complete, before the task can be executed.
```javascript
var plan = {
    A: {
        @after: ['D', 'B']
    }
};
```

## Usa cases

#### Series execution
This will execute tasks sequentially.
```javascript
// A then B then C
var plan = {
    A: {}
    B: { @after: 'A' }
    C: { @after: 'B' }
}
```

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

#### Caching example
```javascript
var plan = {
    A: {
        @in: 'TOPIC'
    },
    C: {
        @out: {
            result: 'TOPIC',
            error: 'CACHE_ERROR'
        }
    },
    B: {
        @after: 'CACHE_ERROR',
        @out: 'TOPIC'
    }
};
```

## Task loading

Given the caching example
```javascript
A: {
    @in: 'TOPIC'
},
C: {
    @out: {
        result: 'TOPIC',
        error: 'CACHE_ERROR'
    }
},
B: {
    @after: 'CACHE_ERROR',
    @out: 'TOPIC'
}
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
    input.get('data', function (err, data) {
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
