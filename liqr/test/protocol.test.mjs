// liqr/test/protocol.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePage, decodePage, encodeMeta, decodeMeta, isValidTaskId, SEP } from '../core/protocol.mjs';

const meta = { v:1, t:'A', name:'x.txt', size:10, pages:2, fps:2, ecc:'M', hash:'sha256:abc' };

test('T2-C1 encodePage', () => { assert.equal(encodePage('A', 3, 'hello'), 'A3|hello'); });
test('T2-C2 decodePage 基本', () => {
  assert.deepEqual(decodePage('A3|hello'), { taskId:'A', pageNum:3, payload:'hello' });
});
test('T2-C3 载荷含 | 切第一个', () => {
  assert.equal(decodePage('B0|a|b|c').payload, 'a|b|c');
});
test('T2-C4 页码变长', () => { assert.equal(decodePage('A12345|x').pageNum, 12345); });
test('T2-C5 非法返回 null', () => {
  assert.equal(decodePage('A3'), null);
  assert.equal(decodePage(''), null);
  assert.equal(decodePage('|x'), null);
  assert.equal(decodePage('a3|x'), null);
});
test('T2-C6 encodePage 严格校验', () => {
  assert.throws(() => encodePage('a', 1, 'x'), TypeError);
  assert.throws(() => encodePage('A', -1, 'x'), TypeError);
  assert.throws(() => encodePage('A', 1.5, 'x'), TypeError);
});
test('T2-C7 meta 对称与第0页', () => {
  assert.deepEqual(decodeMeta(encodeMeta(meta)), meta);
  const p0 = encodePage('A', 0, encodeMeta(meta));
  assert.equal(p0.indexOf('A0|'), 0);
  const d = decodePage(p0);
  assert.equal(d.pageNum, 0);
  assert.deepEqual(decodeMeta(d.payload), meta);
});
test('T2-C8 容错前导 BOM (qrcodejs 注入)', () => {
  assert.deepEqual(decodePage('\uFEFFA3|hello'), { taskId:'A', pageNum:3, payload:'hello' });
});
test('isValidTaskId', () => {
  assert.equal(isValidTaskId('A'), true);
  assert.equal(isValidTaskId('Z'), true);
  assert.equal(isValidTaskId('a'), false);
  assert.equal(isValidTaskId('1'), false);
  assert.equal(isValidTaskId('AB'), false);
});
