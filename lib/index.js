'use strict';

var utils = require('./utils');
var Orchestrator = require('./orchestrator').Orchestrator;

module.exports.start = function start(plan, options, callback) {

    try {
        utils.validatePlan(plan);
    }
    catch(err) {
        callback(err);
    }

    var orchestrator = new Orchestrator(plan, options);
    return orchestrator.start(options.ctx || {}, callback);
};