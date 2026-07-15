// qrpipe/test/receiver-html.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', p), 'utf8');

test('T7-C1 lib/jsQR.min.js 非空', () => {
  const st = statSync(join(here, '..', 'lib', 'jsQR.min.js'));
  assert.ok(st.size > 5120, 'jsQR.min.js 应大于 5KB');
});
test('T7-C2 receiver.html 关键能力', () => {
  const html = read('receiver.html');
  assert.ok(html.includes("from './core/index.mjs'"));
  assert.ok(html.includes('jsQR.min.js'));
  assert.ok(html.includes('getUserMedia'));
  assert.ok(/indexedDB/i.test(html));
  assert.ok(html.includes('clearDB'));
});
test('T7-C3 receiver.html 拼装/校验/UI', () => {
  const html = read('receiver.html');
  assert.ok(html.includes('reassemble'));
  assert.ok(/缺页|missing/i.test(html));
  assert.ok(/下载|download/i.test(html));
  assert.ok(/sender-single\.html/.test(read('receiver.html')));
});
test('T7-C4 解析路径与 core 一致（复用 reassemble）', async () => {
  const { buildPages, decodePage, reassemble } = await import('../core/index.mjs');
  const enc = (s) => new TextEncoder().encode(s);
  const text = 'receiver 解析路径一致性测试 中英 mix abc';
  const built = await buildPages(enc(text), 20, 'B', { name:'r.txt', fps:2, ecc:'M' });
  // 模拟 receiver 收到的二维码字符串（第0页 + 数据页）
  const got = [built.metaPage, ...built.dataPages];
  const meta = decodePage(got[0]);
  const metaObj = JSON.parse(meta.payload);
  const collected = new Map();
  for (const s of got.slice(1)) { const d = decodePage(s); collected.set(d.pageNum, d.payload); }
  const res = await reassemble(metaObj, collected);
  assert.equal(res.ok, true);
  assert.equal(res.hashOk, true);
});
