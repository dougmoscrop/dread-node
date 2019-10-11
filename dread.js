'use strict';

const configure = require('./configure');
const execute = require('./execute');
const { exp, JitterType } = require('./backoff');
const { prop, is, code, always } = require('./condition');

const defaults = {
  attempts: 10,
  condition: prop('retryable'),
  backoff: exp(),
  timeout: undefined,
};

module.exports = function dread() {
  let task, config = defaults;

  for (const arg of arguments) {
    if (typeof arg === 'function') {
      task = arg;
    } else {
      config = configure(arg, config);
    }
  }

  return typeof task === 'function'
    ? execute(task, config)
    : dread.bind(null, config);
};

Object.assign(module.exports, { prop, is, code, exp, always, JitterType });
