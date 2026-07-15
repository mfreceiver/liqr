// qrpipe/test/params.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QR_CAPACITY, VMAX, ECC_LEVELS, maxStepBytes, estimateTime, recommendVersion } from '../core/params.mjs';

test('T4-C1 容量锚点值', () => {
  assert.equal(QR_CAPACITY[10].M, 213);
  assert.equal(QR_CAPACITY[1].L, 17);
});
test('T4-C2 maxStepBytes', () => {
  assert.equal(maxStepBytes(10, 'M', 2), 209);
});
test('T4-C3 estimateTime', () => {
  assert.equal(estimateTime(10, 2), 5);
  assert.equal(estimateTime(10, 0), null);
});
test('T4-C4 recommendVersion 正常', () => {
  assert.equal(recommendVersion(150, 'M', 2), 9);
});
test('T4-C5 recommendVersion 超限', () => {
  assert.equal(recommendVersion(300, 'M', 2), null);
});
test('T4-C6 容量单调递增', () => {
  for (let v = 1; v < VMAX; v++) {
    for (const e of ECC_LEVELS) assert.ok(QR_CAPACITY[v][e] <= QR_CAPACITY[v+1][e], `V${v}.${e}`);
  }
});
