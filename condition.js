'use strict';

function prop(n) {
  return err => !!err[n];
}

function is(t) {
  return err => err instanceof t;
}

function code(v) {
  return err => err.code === v;
}

function always() {
  return () => true;
}

module.exports = { prop, is, code, always };
