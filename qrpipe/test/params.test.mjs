// qrpipe/test/params.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QR_CAPACITY, VMAX, ECC_LEVELS, maxStepBytes, estimateTime, recommendVersion, pickVersion } from '../core/params.mjs';

const countBits = (v) => v < 10 ? 8 : 16;
const parsedBytes = (s) => {
  const bytes = new TextEncoder().encode(s).length;
  return bytes + (bytes !== s.length ? 3 : 0);
};
function expectedVersion(s, ecc) {
  const p = parsedBytes(s);
  for (let v = 1; v <= VMAX; v++) {
    if (4 + countBits(v) + 8 * p <= 8 * QR_CAPACITY[v][ecc]) return v;
  }
  return null;
}

test('T4-C1 容量锚点值', () => { assert.equal(QR_CAPACITY[10].M, 213); assert.equal(QR_CAPACITY[1].L, 17); });
test('T4-C2 maxStepBytes', () => { assert.equal(maxStepBytes(10, 'M', 2), 209); });
test('T4-C3 estimateTime', () => { assert.equal(estimateTime(10, 2), 5); assert.equal(estimateTime(10, 0), null); });
test('T4-C4 recommendVersion 正常', () => { assert.equal(recommendVersion(150, 'M', 2), 9); });
test('T4-C5 recommendVersion 超限', () => { assert.equal(recommendVersion(300, 'M', 2), null); });
test('T4-C6 容量单调递增', () => {
  for (let v = 1; v < VMAX; v++) for (const e of ECC_LEVELS) assert.ok(QR_CAPACITY[v][e] <= QR_CAPACITY[v + 1][e]);
});

test('pickVersion 使用 TextEncoder + 单次 BOM 的正确模型', () => {
  for (const s of ['中a', '中文混合abc内容def'.repeat(5), '😀', '😀'.repeat(4), '𠮷', '𠮷'.repeat(4)]) {
    assert.equal(pickVersion(s, 'L'), expectedVersion(s, 'L'), s);
  }
  assert.equal(parsedBytes('😀'), 7);
  assert.equal(parsedBytes('𠮷'), 7);
  assert.equal(pickVersion('中文混合abc内容def'.repeat(5), 'L'), expectedVersion('中文混合abc内容def'.repeat(5), 'L'));
});

test('pickVersion V10-L 边界严格遵循模型字节数', () => {
  const prefix = 'A0|';
  const capacity = 268 - parsedBytes(prefix);
  const fit = prefix + 'a'.repeat(capacity);
  const over = prefix + 'a'.repeat(capacity + 1);
  assert.equal(parsedBytes(fit), 268);
  assert.equal(pickVersion(fit, 'L'), 10);
  assert.equal(pickVersion(over, 'L'), null);
});

test('pickVersion 294-byte repro 元信息可选版本', () => {
  const meta = 'A0|' + JSON.stringify({v:1,t:'A',name:'新建文本文档.txt',size:294,pages:6,fps:2,ecc:'L',hash:'sha256:'+'0'.repeat(64)});
  const version = pickVersion(meta, 'L');
  assert.ok(version >= 1 && version <= 10);
});

test('pickVersion 超 VMAX 返回 null', () => { assert.equal(pickVersion('A'.repeat(400), 'L'), null); });
