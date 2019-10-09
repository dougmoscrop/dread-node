'use strict';

const assert = require('assert');

const JitterType = Object.freeze({
  NONE: 'NONE', // use full backoff
  FULL: 'FULL', // random value between 0 and backoff
  HALF: 'HALF', // random value between backoff/2 and backoff
});

function getJitter({ jitter = JitterType.FULL }) {
  if (typeof jitter === 'boolean') {
    return jitter ? JitterType.FULL : JitterType.NONE;
  }

  return jitter.toUpperCase();
}

function backoff(number, base, factor, cap) {
  return Math.min(base * Math.pow(factor, number), cap);
}

function exp(options = {}) {
  const { base = 100, factor = 2, limit = 10000} = options;

  assert(Number.isInteger(base), 'base must be an integer');
  assert(Number.isInteger(factor), 'factor must be an integer');
  assert(Number.isInteger(limit), 'limit must be an integer');

  const cap = limit || Number.MAX_SAFE_INTEGER;
  const jitter = getJitter(options);

  assert(typeof jitter === 'string', 'jitter must be string');
  assert(jitter in JitterType, `invalid jitter value, use JitterType ${Object.keys(JitterType)}`);

  switch (jitter) {
    case JitterType.FULL:
      return number => Math.round(Math.random() * backoff(number, base, factor, cap));
    case JitterType.HALF:
      return number => {
        const halfBackoff = backoff(number, base, factor, cap) / 2;
        return Math.round(halfBackoff + (Math.random() * halfBackoff));
      }
    case JitterType.NONE:
    default:
      return number => Math.round(backoff(number, base, factor, cap));
  }
}

module.exports = { exp, JitterType };
