// liqr/test/paginate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, utf8Iterate, MIN_STEP } from '../core/paginate.mjs';

const enc = (s) => new TextEncoder().encode(s);

test('T1-C1 ASCII 按字节切分', () => {
  // 注：原 brief 此处用 step=3，但 T1-C5 要求 stepBytes < MIN_STEP(4) 抛 RangeError，
  // 两者互斥。经确认改为 step=4（仍演示纯 ASCII 按字节切分）。
  assert.deepEqual(paginate(enc('abcdef'), 4), ['abcd', 'ef']);
});
test('T1-C2 不切断 UTF-8 字符', () => {
  assert.deepEqual(paginate(enc('ab中'), 4), ['ab', '中']);
});
test('T1-C3 确定性', () => {
  const b = enc('你好世界hello');
  assert.deepEqual(paginate(b, 7), paginate(b, 7));
});
test('T1-C4 边界: 空 与 emoji', () => {
  assert.deepEqual(paginate(enc(''), 4), []);
  assert.deepEqual(paginate(enc('😀'), 4), ['😀']);
});
test('T1-C5 stepBytes < MIN_STEP 抛 RangeError', () => {
  assert.throws(() => paginate(enc('abc'), 3), RangeError);
});
test('utf8Iterate 产出 char 与 byteLen', () => {
  const it = utf8Iterate(enc('a中'));
  assert.deepEqual(it.next().value, { char: 'a', byteLen: 1 });
  assert.deepEqual(it.next().value, { char: '中', byteLen: 3 });
  assert.equal(it.next().done, true);
});
