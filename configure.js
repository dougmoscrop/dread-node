'use strict';

const assert = require('assert');

module.exports = function configure(arg, current) {
  if (arg.retries) {
    if (arg.attempts) {
      throw new Error('Specify attempts or retries, but not both');
    }
    arg.attempts = arg.retries + 1;
    delete arg.retries;
  }

  const {
    attempts = current.attempts,
    backoff = current.backoff,
    condition = current.condition,
    timeout = current.timeout,
  } = arg;

  assert(Number.isInteger(attempts) && attempts > 0, 'attempts must be an integer > 0');
  assert(typeof backoff === 'function', 'backoff must be a function');
  assert(typeof condition === 'function', 'condition must be a function')
  assert(timeout === undefined || Number.isInteger(timeout), 'timeout, if specified, must be a number');

  arg.attempts = attempts;
  arg.backoff = backoff;
  arg.condition = condition;
  arg.timeout = timeout;

  return arg;
};
