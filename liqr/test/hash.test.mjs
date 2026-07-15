// liqr/test/hash.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex, _pureJsSha256Hex } from '../core/hash.mjs';

const enc = (s) => new TextEncoder().encode(s);

test('T3-C1 空字节 NIST 向量', async () => {
  assert.equal(await sha256Hex(enc('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
test('T3-C2 abc NIST 向量', async () => {
  assert.equal(await sha256Hex(enc('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('T3-C3 与 node:crypto 交叉验证', async () => {
  const data = enc('你好，世界！liqr 测试 hello 1234567890');
  const expected = createHash('sha256').update(data).digest('hex');
  assert.equal(await sha256Hex(data), expected);
});
test('T3-C4 纯 JS fallback 与 subtle 一致', async () => {
  const data = enc('fallback 一致性测试 😀 emoji');
  const expected = createHash('sha256').update(data).digest('hex');
  assert.equal(await _pureJsSha256Hex(data), expected);
  assert.equal(await _pureJsSha256Hex(data), await sha256Hex(data));
});
