'use strict';

var utils = module.exports;

module.exports.normalizePlan = function normalizePlan(plan) {
    return Object.keys(plan).map(function map(name) {
        var taskDef = plan[name];
        var result = {
            name: name
        };
        var inAttr = utils.getFieldMap(taskDef['@in'] ? taskDef['@in'] :
            (typeof taskDef === 'string' || Array.isArray(taskDef)) ? taskDef : undefined);
        if (inAttr) {
            result.in = inAttr;
        }
        var ifAttr = utils.getIf(taskDef);
        if (ifAttr) {
            result.if = ifAttr;
        }
        var outAttr = utils.getFieldMap(taskDef['@out']);
        if (outAttr) {
            result.out = outAttr;
        }

        return result;
    });
};

// The output is a map of input names to topics
/* Possible variants of @in
    - implicit:
        - one topic
        - multiple topics, array
    - explicit @in:
        - one topic
        - multiple topics, array
        - mapping, multiple:
            - input to topic
            - inout to topics
*/
module.exports.getFieldMap = function getFieldMap(def) {
    var type = typeof def;
    // implicit, one topic
    if (type === 'string') {
        return topicArrayToMap([def]);
    }
    // multiple topics, array
    else if (Array.isArray(def)) {
        return topicArrayToMap(def);
    }

    return def;
};

module.exports.getIf = function getIf(def) {
    def = def['@if'];
    if (!def) {
        return;
    }

    def = typeof def === 'string' ? [def] : def;
    if (Array.isArray(def)) {
        return def;
    }
    console.error(new Error('Unknown type to convert ' + def));
};

function topicArrayToMap(arr) {
    return arr.reduce(function reduce(memo, topic) {
        memo = memo || {};
        memo[topic] = topic;
        return memo;
    }, undefined);
}

module.exports.normalizePlanDependencies = function normalizePlanDependencies(plan) {
    // loop thriugh the tasks and find all publishing topics
    // that does not match name of the task
    // and add them to the plan as if they were tasks with dependencies,
    // where dependencies are the task that generate them
    var outs = Object.keys(plan).reduce(function reduce(memo, task) {
        var def = plan[task];
        var out = def['@out'];
        if (out) {
            memo[task] = out;
        }
        return memo;
    }, {});

    // reverse out and assign back to the plan
    Object.keys(outs).forEach(function forEach(task) {
        var out = outs[task];
        out = typeof out === 'string' ? [out] :
            Array.isArray(out) ? out : Object.keys(out).map(function map(outName) {
                var topic = out[outName];
                return topic;
            });

        out.forEach(function forEach(topic) {
            if (topic !== task) {
                var deps = plan[topic] = plan[topic] || [];
                deps.push(task);
            }
        });

    });

    return plan;
};

module.exports.validatePlan = function validatePlan(plan) {

    plan = utils.normalizePlanDependencies(plan);

    for (var entryTask in plan) {

        var ctx = {
            map: {},
            chain: [entryTask],
            plan: plan
        };

        ctx.map[entryTask] = true;

        var chain = findCircularDependency(entryTask, ctx);
        if (chain) {
            throw new Error('Circular dependency found for "'+entryTask+'", path: '+chain.join('->'));
        }
    }
};

function findCircularDependency(task, ctx) {
    var plan = ctx.plan;

    var dependencies = plan[task] || {};
    for (var input in dependencies) {

        if (input === '@out') {
            continue;
        }

        var depTask = dependencies[input];
        if (ctx.map[depTask]) {
            ctx.chain.push(depTask);
            return ctx.chain;
        }

        var nextCtx = {
            map: Object.create(ctx.map),
            chain: Object.create(ctx.chain),
            plan: plan
        };

        nextCtx.map[depTask] = true;
        nextCtx.chain.push(depTask);

        var path = findCircularDependency(depTask, nextCtx);
        if (path) {
            return path;
        }
    }
}

module.exports.tryRequire = function tryRequire(name) {
    try {
        require(name);
    }
    catch (err) {

    }
};

module.exports.boom = function boom(target, err, next) {
    if (next) {
        return next(err);
    }
    if (target.emit) {
        return target.emit('error', err);
    }
    throw err;
};
