// qrpipe/test/sender-html.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', p), 'utf8');

test('T6-C1 lib/qrcode.min.js 非空', () => {
  const st = statSync(join(here, '..', 'lib', 'qrcode.min.js'));
  assert.ok(st.size > 1024, 'qrcode.min.js 应大于 1KB');
});
test('T6-C2 sender.html 关键 UI 元素', () => {
  const html = read('sender.html');
  assert.ok(html.includes('type="file"'));
  assert.ok(/步长|step/i.test(html));
  assert.ok(/任务序号|task/i.test(html));
  assert.ok(html.includes('QRCode'));
  assert.ok(/重传|retransmit|retrans/i.test(html));
});
test('T6-C3 sender.html 内联 core 关键函数', () => {
  const html = read('sender.html');
  for (const fn of ['paginate', 'encodePage', 'encodeMeta', 'sha256Hex', 'buildPages', 'recommendVersion']) {
    assert.ok(html.includes(fn), `sender.html 应内联 ${fn}`);
  }
  assert.ok(html.includes('pickVersion'), 'sender.html 应内联 pickVersion');
});
test('sender-single.html 单文件自包含', () => {
  const st = statSync(join(here, '..', 'sender-single.html'));
  assert.ok(st.size > 15000, 'sender-single.html 应含内联 qrcodejs (>15KB)');
  const html = readFileSync(join(here, '..', 'sender-single.html'), 'utf8');
  assert.ok(!html.includes('src="lib/qrcode.min.js"'), '单文件不应再外引 lib');
  assert.ok(html.includes('pickVersion'), '单文件应含 pickVersion 修复');
  assert.ok(html.includes('this._htOption.typeNumber>0?'), 'sender-single.html should contain patched makeCode');
});
