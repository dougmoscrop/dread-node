'use strict';

const RETRYABLE = Symbol();

module.exports = async function execute(task, { attempts, backoff, condition, timeout }) {
  let number = 1, result, control, operationHandle, attemptHandle, delayHandle;

  function abort(reason, retryable = true) {
    if (result) {
      return;
    }

    const error = typeof reason === 'string'
      ? new Error(reason)
      : reason;

    error[RETRYABLE] = retryable;
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
      const retryable = error[RETRYABLE];
      delete error[RETRYABLE];

      if (number < attempts) {
        const shouldRetry = retryable === undefined
          ? await condition(error)
          : retryable;

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
