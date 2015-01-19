'use strict';

module.exports.validatePlan = function validatePlan(plan) {
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