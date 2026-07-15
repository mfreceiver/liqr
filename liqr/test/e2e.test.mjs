// liqr/test/e2e.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPages, reassemble, decodePage, decodeMeta, recommendVersion } from '../core/index.mjs';

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

const TEXT = '你好，liqr！这是一段用于端到端测试的中文与 English 混合文本。\n第二行换行。12345';

async function collectAll(built) {
  const map = new Map();
  for (const s of built.dataPages) {
    const d = decodePage(s);
    map.set(d.pageNum, d.payload);
  }
  return map;
}

test('T5-C1 端到端还原', async () => {
  const built = await buildPages(enc(TEXT), 30, 'A', { name:'demo.txt', fps:2, ecc:'M' });
  const map = await collectAll(built);
  const res = await reassemble(built.meta, map);
  assert.equal(res.ok, true);
  assert.equal(res.hashOk, true);
  assert.equal(dec(res.bytes), TEXT);
});
test('T5-C2 可复现', async () => {
  const a = await buildPages(enc(TEXT), 30, 'A', { name:'demo.txt', fps:2, ecc:'M' });
  const b = await buildPages(enc(TEXT), 30, 'A', { name:'demo.txt', fps:2, ecc:'M' });
  assert.deepEqual([a.metaPage, ...a.dataPages], [b.metaPage, ...b.dataPages]);
});
test('T5-C3 缺页', async () => {
  const built = await buildPages(enc(TEXT), 30, 'A', { name:'demo.txt', fps:2, ecc:'M' });
  const map = await collectAll(built);
  map.delete(3);
  const res = await reassemble(built.meta, map);
  assert.equal(res.ok, false);
  assert.ok(res.missing.includes(3));
});
test('T5-C4 补传后齐全', async () => {
  const built = await buildPages(enc(TEXT), 30, 'A', { name:'demo.txt', fps:2, ecc:'M' });
  const map = await collectAll(built);
  map.delete(3);
  const r1 = await reassemble(built.meta, map);
  assert.deepEqual(r1.missing, [3]);
  // 模拟补传：从原序列找回第3页
  const again = await collectAll(built);
  map.set(3, again.get(3));
  const r2 = await reassemble(built.meta, map);
  assert.equal(r2.ok, true);
});
test('T5-C5 默认参数合法', async () => {
  const built = await buildPages(enc(TEXT), 150, 'A', { name:'demo.txt', fps:2, ecc:'M' });
  const digits = String(built.pages).length;
  assert.ok(recommendVersion(150, 'M', digits) != null);
});
