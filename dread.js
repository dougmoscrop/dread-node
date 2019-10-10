'use strict';

const { exp, JitterType } = require('./backoff');
const { prop, is, code, always } = require('./condition');
const { configure, RETRY } = require('./help');

const defaults = {
  attempts: 10,
  condition: prop('retryable'),
  backoff: exp(),
  timeout: 0,
};

module.exports = function dread(options = {}) {
  const base = configure(options, defaults);

  return async (taskOrOverrides, taskOrNothing) => {
    const task = taskOrNothing || taskOrOverrides;
    const config = taskOrNothing ? configure(taskOrOverrides, base) : base;

    const { attempts, backoff, condition, timeout} = config;

    let number = 1, result, control, operationHandle, attemptHandle, delayHandle;

    function abort(reason, retry = true) {
      if (result) {
        return;
      }

      const error = typeof reason === 'string'
        ? new Error(reason)
        : reason;

      error[RETRY] = retry;
      control(error);
    }

    const attempt = {
      get attempt() {
        return number;
      },
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

Object.assign(module.exports, { prop, is, code, exp, always, JitterType });
