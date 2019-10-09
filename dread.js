'use strict';

const assert = require('assert');

const { exp, JitterType } = require('./backoff');
const { prop, is, code, RETRY } = require('./help');

module.exports = function dread(options = {}) {
  const { attempts = 10, condition = prop('retryable'), backoff = exp(), timeout = 0 } = options;

  assert(Number.isInteger(attempts) && attempts > 0, 'attempts must be an integer > 0');
  assert(typeof condition === 'function', 'condition must be a function')
  assert(typeof backoff === 'function', 'backoff must be a function');
  assert(Number.isInteger(timeout), 'timeout nust be a number');

  return async task => {
    let number = 1, result, control, operationHandle, attemptHandle, delayHandle;

    function abort(reason, retry = true) {
      if (result) {
        return;
      }

      assert(typeof reason === 'string', 'reason must be a string');
      const error = new Error(reason);

      error[RETRY] = retry;
      control(error);
    }

    const attempt = {
      get number() {
        return number;
      },
      cancel(reason = 'Attempt cancelled') {
        abort(reason);
      },
      timeout(duration) {
        clearTimeout(attemptHandle);
        attemptHandle = setTimeout(function attemptTimeout() {
          abort(`Attempt timed out after ${duration} ms`);
        }, duration);
      },
    };

    if (timeout) {
      operationHandle = setTimeout(function operationTimeout() {
        abort(`Operation timed out after ${timeout} ms`, false);
      }, timeout);
    }

    for (;; number += 1) {
      try {
        result = await Promise.race([
          new Promise((_, reject) => { control = reject }),
          task(attempt),
        ]);
        return result;
      } catch (error) {
        const retry = error[RETRY];
        delete error[RETRY];

        if (number < attempts) {
          const shouldRetry = retry === undefined
            ? await condition(error)
            : retry;

          if (shouldRetry) {
            const delay = await backoff(number, error);

            await new Promise(resolve => {
              delayHandle = setTimeout(resolve, delay);
            });

            continue;
          }
        }

        throw error;
      } finally {
        clearTimeout(delayHandle);
        clearTimeout(attemptHandle);
        clearTimeout(operationHandle);
      }
    }
  };
};

Object.assign(module.exports, { prop, is, code, exp, JitterType });
