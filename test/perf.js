const { performance } = require('perf_hooks');

const test = require('ava');

const dread = require('..');

const count = 10000;

async function bench(fn) {
    const start = performance.now();

    for (let i = 0; i < count; i += 1) {
        await fn();
    }

    return performance.now() - start;
}

test.serial(`direct`, async t => {
  const baseline = await bench(Function.prototype);
  const dreadful = await bench(() => dread(Function.prototype));
  const actual = (dreadful - baseline) / count;
  const allowed = 0.01;

  t.true(actual < allowed);
});

test.serial(`direct with overrides`, async t => {
  const baseline = await bench(Function.prototype);
  const dreadful = await bench(() => dread({ attempts: 2 }, Function.prototype));
  const actual = (dreadful - baseline) / count;
  const allowed = 0.01;

  t.true(actual < allowed);
});

test.serial(`via builder`, async t => {
    const retry = dread();

    const baseline = await bench(Function.prototype);
    const dreadful = await bench(() => retry(Function.prototype));
    const actual = (dreadful - baseline) / count;
    const allowed = 0.01;

    t.true(actual < allowed);
});

test.serial(`via builder with override`, async t => {
  const retry = dread({ attempts: 2 });

  const baseline = await bench(Function.prototype);
  const dreadful = await bench(() => retry({ attempts: 1 }, Function.prototype));
  const actual = (dreadful - baseline) / count;
  const allowed = 0.01;

  t.true(actual < allowed);
});

test.serial(`fully loaded with timeouts`, async t => {
    const retry = dread({ timeout: 1000 });

    const baseline = await bench(Function.prototype);
    const dreadful = await bench(() => retry(attempt => attempt.timeout(1000)));
    const actual = (dreadful - baseline) / count;
    const allowed = 0.02;

    t.true(actual < allowed);
});
