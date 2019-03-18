# dread

When you just know things will fail

## Usage

The most basic, batteries-included example:

```js
const dread = require('dread');
const retry = dread();

// this will retry 10 times with fully randomized and truncated exponential backoff
retry(attempt => {
    console.log('attempt number', attempt.number);
    // do stuff
});
```

## Options

The default configuration is equivalent to:

```js
dread({
    attempts: 10,
    condition: dread.prop('retryable'),
    backoff: dread.exp(),
});
```

### attempts

The number of attempts inclusive of the first one

```js
// fewer attempts than default
dread({ attempts: 5 });
```

### condition

A function `Error => Boolean` that determines whether or not to retry a failed attempt.

You can provide any function you want, including async.

`dread` exports helpers:

- `dread.prop(name)` rery if `err.prop` is truthy
- `dread.code(String)` retry if `err.code === String`
- `dread.is(Class)` retry if `err instanceof Class`

### backoff

A function `(Integer, Error) => Integer` that returns the amount of time to wait before the next attempt.

You can provide any function you want, including async. The `Error` is provided in case you want to have different retry periods for different error cases, or, as in the case of `aws-sdk`, it already provides a backoff duration on its errors.

`dread` exports a helper:

```js
// this is the default - a fully randomized, truncated exponential value
dread.exp({ 
    base: Number(100),
    factor: Number(2),
    limit: Number(10000),
    jitter: Boolean(true)
});
```

### timeout

`dread` supports a timeout for the entire operation, as well as an individual attempt:

```js
const retry = dread({ timeout: 10000 });
// the operation will timeoUt after 10 seconds
retry(attempt => {
    // the attempt will timeout after 1 second, inclusive of the backoff delay
    attempt.timeout(5000);
});
```

### cancel

You can cancel an attempt manually by calling `attempt.cancel(reason)` optionally providing either an Error or a String, which will be used as the error message.

```js
const retry = dread();

retry(attempt => {
    attempt.cancel();
});
```

> Note: Calling cancel after an attempt has succeeded has no effect.