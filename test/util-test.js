'use strict';

var assert = require('assert');
var utils = require('../lib/utils');

describe(__filename, function () {

    it('should detect simple circular dependency', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in": "A"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->A', err.message);
            done();
        }
    });

    it('should detect circular dependency', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in": "B"
                },
                "B": {
                    "in": "A"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->A', err.message);
            done();
        }
    });

    it('should detect complex circular dependency', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in": "B"
                },
                "B": {
                    "in": "C"
                },
                "C": {
                    "in": "D"
                },
                "D": {
                    "in": "B"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->C->D->B', err.message);
            done();
        }
    });

    it('should detect complex circular dependency 2', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in1": "B",
                    "in2": "C"
                },
                "B": {
                    "in": "C"
                },
                "C": {
                    "in": "D"
                },
                "D": {
                    "in": "B"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->C->D->B', err.message);
            done();
        }
    });

    it('should detect complex circular dependency 3', function (done) {
        try {
            utils.validatePlan({
                "A": {
                    "in1": "B",
                    "in2": "C"
                },
                "B": {
                    "in1": "C",
                    "in2": "D"
                },
                "C": {
                    "in": "D"
                },
                "D": {
                    "in": "B"
                }
            });
            done(new Error('should have failed'));
        }
        catch (err) {
            assert.equal('Circular dependency found for "A", path: A->B->C->D->B', err.message);
            done();
        }
    });

    it('should not detect circular dependency', function (done) {
        utils.validatePlan({
            "A": {}
        });
        done();
    });

    it('should not detect circular dependency 1', function (done) {
        utils.validatePlan({
            "A": {
                "in": "B"
            }
        });
        done();
    });

    it('should not detect circular dependency 2', function (done) {
        utils.validatePlan({
            "A": {
                "in": "B"
            },
            "B": {
                "in": "C"
            }
        });
        done();
    });

    it('should not detect circular dependency 3', function (done) {
        utils.validatePlan({
            "A": {
                "in1": "B",
                "in2": "C"
            },
            "B": {
                "in": "C"
            }
        });
        done();
    });

});