const assert = require('assert');

function prop(n) {
    return err => !!err[n];
}

function is(t) {
    return err => err instanceof t;
}

function code(v) {
    return err => err.code === v;
}

function exp(options = {}) {
    const { base = 100, factor = 2, limit = 10000, jitter = true } = options;

    assert(Number.isInteger(base), 'base must be an integer');
    assert(Number.isInteger(factor), 'factor must be an integer');
    assert(Number.isInteger(limit), 'limit must be an integer');
    assert(typeof jitter === 'boolean', 'jitter must be an boolean');

    const cap = limit || Number.MAX_SAFE_INTEGER;
    const amount = number => Math.min(base * Math.pow(factor, number), cap);

    return jitter
        ? number => Math.round(Math.random(base, amount(number)))
        : number => Math.round(amount(number));
}

const RETRY = Symbol();

function shouldRetry(error, condition) {
    if (RETRY in error) {
        return error[RETRY];
    }
    return condition(error);
}

module.exports = function dread(options = {}) {
    const { attempts = 10, condition = prop('retryable'), backoff = exp(), timeout = 0 } = options;

    assert(Number.isInteger(attempts) && attempts > 0, 'attempts must be an integer > 0');
    assert(typeof condition === 'function', 'condition must be a function')
    assert(typeof backoff === 'function', 'backoff must be a function');
    assert(Number.isInteger(timeout), 'timeout nust be a number');

    return async task => {
        let number = 1, result, abort, operationHandle, attemptHandle, delayHandle;

        const attempt = {
            number,
            cancel: (reason = 'Cancelled') => {
                if (result) {
                    return;
                }

                const err = reason instanceof Error
                    ? reason
                    : new Error(reason);
    
                abort(err);
            },
            timeout: duration => {
                clearTimeout(attemptHandle);
                attemptHandle = setTimeout(() => {
                    const error = new Error(`Attempt timed out after ${duration} ms`);
                    error[RETRY] = true;
                    attempt.cancel(error);
                }, duration);
            }
        };

        if (timeout) {
            operationHandle = setTimeout(() => {
                const error = new Error(`Operation timed out after ${timeout} ms`);
                error[RETRY] = false;
                attempt.cancel(error);
            }, timeout);
        }

        for (;; number += 1) {
            const aborted = new Promise((_, reject) => abort = reject);

            try {
                result = await Promise.race([
                    task(attempt),
                    aborted
                ]);
                return result;
            } catch (error) {
                if (number < attempts) {
                    const retry = await shouldRetry(error, condition);

                    if  (retry) {
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

Object.assign(module.exports, { prop, is, code, exp });