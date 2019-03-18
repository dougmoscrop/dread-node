const { performance } = require('perf_hooks');

const test = require('ava');

const dread = require('..');

const count = 100000;

async function bench(fn) {
    const start = performance.now();

    for (let i = 0; i < count; i += 1) {
        await fn();
    }

    return performance.now() - start;
}

test.serial(`bare bones`, async t => {
    const retry = dread();

    const baseline = await bench(Function.prototype);
    const dreadful = await bench(() => retry(Function.prototype));
    const actual = (dreadful - baseline) / count;
    const allowed = 0.01;

    t.true(actual < allowed);
});


test.serial(`fully loaded with timeouts`, async t => {
    const retry = dread({ timeout: 1000 });

    const baseline = await bench(Function.prototype);
    const dreadful = await bench(() => retry(attempt => attempt.timeout(1000)));
    const actual = (dreadful - baseline) / count;
    const allowed = 0.01;

    t.true(actual < allowed);
});