'use strict';

var utils = require('./utils');
var Orchestrator = require('./orchestrator').Orchestrator;

module.exports.start = function start(plan, options, callback) {
    var args = Array.prototype.slice.call(arguments);
    plan = args.shift();
    callback = args.pop();
    options = args.shift() || {};

    var orchestrator = new Orchestrator(plan, options);
    return orchestrator.start(options.ctx || {}, callback);
};
