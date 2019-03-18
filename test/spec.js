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

test('cancel', async t => {
    const retry = dread();

    try {
        await retry(attempt => {
            setTimeout(() => {
                attempt.cancel('Abort! Abort!');
            }, 100);
            return new Promise(Function.prototype);
        });
        t.fail('should not reach here');
    } catch (err) {
        t.is(err.message, 'Abort! Abort!');
    }
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