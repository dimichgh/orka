REPORTER = spec
BASE = .
JSHINT = ./node_modules/.bin/jshint

all: lint test

test:
	@DEBUG=orka:* ./node_modules/.bin/mocha \
	--reporter $(REPORTER)

lint:
	@$(JSHINT) ./lib \
	$(JSHINT) ./test --config $(BASE)/.jshintrc

.PHONY: test docs
