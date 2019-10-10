const test = require('ava');
const sinon = require('sinon');

const dread = require('..');

test('return nothing', async t => {
  const retry = dread();
  const result = await retry(Function.prototype);

  t.is(result, undefined);
});

test('return value', async t => {
  const retry = dread();
  const result = await retry(() => 42);
  t.is(result, 42);
});

test('return promise', async t => {
  const retry = dread();
  const result = await retry(() => Promise.resolve(42));
  t.is(result, 42);
});

test('async function', async t => {
  const retry = dread();
  const result = await retry(async () => {
    return 42;
  });
  t.is(result, 42);
});

test('should retry', async t => {
  const error = new Error('test');
  error.retryable = true;

  const stub = sinon.stub()
    .onCall(0).throws(error)
    .onCall(1).returns(42);

  const retry = dread();
  const result = await retry(stub);

  t.is(result, 42);
  t.is(stub.callCount, 2);
});

test('retrys limit', async t => {
  const error = new Error('test');
  error.retryable = true;

  const stub = sinon.stub().throws(error);

  const retry = dread({
    attempts: 3
  });

  try {
    await retry(stub);
    t.fail('should not reach here');
  } catch (err) {
    t.is(err.message, 'test');
    t.is(stub.callCount, 3);
  }
});

test('no retry', async t => {
  const retry = dread({
    condition: () => false
  });

  try {
      await retry(() => {
        throw new Error('test')
      });
      t.fail('should not reach here');
  } catch (err) {
      t.is(err.message, 'test');
  }
});

test('attempt.number updates', async t => {
  const error = new Error('test');
  error.retryable = true;

  let actualAttempts = 1;
  const retry = dread();
  var attempts = await retry(async function(attempt) {
    t.is(actualAttempts++, attempt.number);
    if(attempt.number >= 5) {
      return attempt.number;
    }
    throw error;
  });
  t.is(attempts, 5);
});

test('cancel results in retry', async t => {
  const retry = dread({ attempts: 2 });

  let calls = 0;

  try {
    await retry(attempt => {
      setTimeout(() => {
        calls++;
        attempt.cancel('Abort! Abort!');
      }, 100);
      return new Promise(Function.prototype);
    });
    t.fail('should not reach here');
  } catch (err) {
    t.is(err.message, 'Abort! Abort!');
  }
  t.is(calls, 2);
});

test('attempt timeout causes retry exhaustion', async t => {
  const retry = dread({ attempts: 2 });
  let calls = 0;
  try {
    await retry(attempt => {
      calls++;
      attempt.timeout(100);
      return new Promise(Function.prototype);
    });
    t.fail('should not reach here');
  } catch (err) {
    t.is(calls, 2);
    t.is(err.message, 'Attempt timed out after 100 ms');
  }
});

test('operation timeout before attempt timeout', async t => {
  const retry = dread({ attempts: 2, timeout: 10 });
  let calls = 0;
  try {
    await retry(attempt => {
      calls++;
      attempt.timeout(100);
      return new Promise(Function.prototype);
    });
    t.fail('should not reach here');
  } catch (err) {
    t.is(calls, 1);
    t.is(err.message, 'Operation timed out after 10 ms');
  }
});

test('cancel after result has no effect', async t => {
  const retry = dread();

  let calls = 0;
  let spy;

  let resolve;

  const promise = new Promise(res => {
    resolve = res;
  });

  const result = await retry(attempt => {
    calls++;
    spy = sinon.spy(attempt, 'cancel');

    setTimeout(() => {
      attempt.cancel();
      resolve();
    }, 100);

    return 'test';
  });

  await promise;

  t.is(calls, 1);
  t.is(result, 'test');
  t.is(spy.called, true);
});

test('cancel throws if reason is not a string', async t => {
  const retry = dread({ attempts: 1 });

  try {
    await retry(attempt => {
      attempt.cancel(1);
    });
    t.fail('should not reach here');
  } catch (err) {
    t.is(err.message, 'reason must be a string');
  }
});

test('dread.exp with 0 limit caps to MAX_SAFE_INTEGER', t => {
  let exp = dread.exp({ factor: 9001, jitter: dread.JitterType.NONE, limit: 0 });

  t.is(exp(10000000), Number.MAX_SAFE_INTEGER);
});

test('dread.exp no jitter', t => {
  let exp = dread.exp({ factor: 1, jitter: dread.JitterType.NONE });
  t.is(exp(1), 100);
  t.is(exp(2), 100);
  t.is(exp(3), 100);

  exp = dread.exp({ factor: 2, jitter: dread.JitterType.NONE });
  t.is(exp(1), 200);
  t.is(exp(2), 400);
  t.is(exp(3), 800);

    exp = dread.exp({ factor: 3, jitter: dread.JitterType.NONE });
  t.is(exp(1), 300);
  t.is(exp(2), 900);
  t.is(exp(3), 2700);
});

test('dread.exp capped at limit', t => {
  const exp = dread.exp({ factor: 3, jitter: dread.JitterType.NONE, limit : 1234 });
  t.is(exp(1), 300);
  t.is(exp(2), 900);
  t.is(exp(3), 1234);
});

function between(t, result, min, max) {
  t.truthy(result >= min);
  t.truthy(result <= max);
}

test('dread.exp jitter', t => {
  let exp = dread.exp({ factor: 3, jitter: dread.JitterType.FULL });
  for (let x = 0; x < 10; x++) {
    between(t, exp(1), 0, 300);
    between(t, exp(2), 0, 900);
    between(t, exp(3), 0, 2700);
  }
  exp = dread.exp({ factor: 3, jitter: dread.JitterType.HALF });
  for (let x = 0; x < 10; x++) {
    between(t, exp(1), 150, 300);
    between(t, exp(2), 450, 900);
    between(t, exp(3), 1350, 2700);
  }
});

test('dread.exp jitter backwards compatible with bool', t => {
  let exp = dread.exp({ factor: 3, jitter: true });
  for (let x = 0; x < 10; x++) {
    between(t, exp(1), 0, 300);
    between(t, exp(2), 0, 900);
    between(t, exp(3), 0, 2700);
  }

  exp = dread.exp({ factor: 3, jitter: false });
  t.is(exp(1), 300);
  t.is(exp(2), 900);
  t.is(exp(3), 2700);
});

test('prop', t => {
    t.is(dread.prop('foo')({ foo: true }), true);
    t.is(dread.prop('foo')({ foo: false }), false);
});

test('code', t => {
    t.is(dread.code('ENOTFOUND')({ code: 'ENOTFOUND' }), true);
    t.is(dread.prop('ENOTFOUND')({ code: '404' }), false);
});

test('is', t => {
  class Foo {}
  class Bar {}

  t.is(dread.is(Foo)(new Foo), true);
  t.is(dread.is(Bar)(new Foo), false);
});

test('dread.exp throws when jitter is invalid', t => {
  const err = t.throws(() => dread.exp({ factor: 3, jitter: 'invalid' }));
  t.is(err.message, 'invalid jitter value, use JitterType NONE,FULL,HALF');
});

test('dread.always returns true', t => {
  const always = dread.always();

  t.is(always(), true);
  t.is(always(false), true);
  t.is(always(new Error()), true);
  t.is(always(null), true);
});
