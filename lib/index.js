'use strict';

var utils = require('./utils');
var Orchestrator = module.exports = require('./orchestrator');

module.exports.create = function create(plan, options) {
    var orchestrator = new Orchestrator(plan, options);
    return orchestrator;
};
