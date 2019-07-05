const assert = require('assert');
const util = require('util');

function prop(n) {
    return err => !!err[n];
}

function is(t) {
    return err => err instanceof t;
}

function code(v) {
    return err => err.code === v;
}

const JitterType = Object.freeze({
	NONE: 'none',// use full backoff
	FULL: 'full',// random value between 0 and backoff
	HALF: 'half',// random value between backoff/2 and backoff
});

function exp(options = {}) {
	const { base = 100, factor = 2, limit = 10000} = options;
	let { jitter = JitterType.FULL } = options;

    assert(Number.isInteger(base), 'base must be an integer');
    assert(Number.isInteger(factor), 'factor must be an integer');
	assert(Number.isInteger(limit), 'limit must be an integer');
	if (typeof jitter === 'boolean') {
		jitter = jitter ? JitterType.FULL : JitterType.NONE;
	}
	assert(typeof jitter === typeof '', 'jitter must be string');
	assert([JitterType.NONE, JitterType.FULL, JitterType.HALF].indexOf(jitter) >= 0, `invalid jitter value, use JitterType ${util.inspect(JitterType)}`);

	const cap = limit || Number.MAX_SAFE_INTEGER;
	const backoff = number => Math.min(base * Math.pow(factor, number), cap);

	switch (jitter) {
		case JitterType.FULL:
			return number => Math.round(Math.random() * (backoff(number) ));
		case JitterType.HALF:
			return number => {
				const halfBackoff = backoff(number) / 2;
				return Math.round(halfBackoff + (Math.random() * halfBackoff));
			}
		case JitterType.NONE:
		default:
			return number => Math.round(backoff(number));// use full backoff
	}
}

const RETRY = Symbol();

function shouldRetry(error, condition) {
    if (RETRY in error) {
        const retry = error[RETRY];
        delete error[RETRY];
        return retry;
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
			attempt.number = number;
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

Object.assign(module.exports, { prop, is, code, exp, JitterType });