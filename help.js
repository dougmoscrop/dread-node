'use strict';

const assert = require('assert');

function configure(options, defaults) {
  const {
    attempts = defaults.attempts,
    backoff = defaults.backoff,
    condition = defaults.condition,
    timeout = defaults.timeout,
  } = options;

  assert(Number.isInteger(attempts) && attempts > 0, 'attempts must be an integer > 0');
  assert(typeof backoff === 'function', 'backoff must be a function');
  assert(typeof condition === 'function', 'condition must be a function')
  assert(Number.isInteger(timeout), 'timeout nust be a number');

  return { attempts, backoff, condition, timeout };
}

const RETRY = Symbol();

module.exports = { configure, RETRY };
