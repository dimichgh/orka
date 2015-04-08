'use strict';

var utils = require('./utils');
var Orchestrator = require('./orchestrator').Orchestrator;

module.exports.create = function create(plan, options) {
    var orchestrator = new Orchestrator(plan, options);
    return orchestrator;
};
