import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVersion } from '../core/params.mjs';

class Ctx {
  fillRect() {}
  strokeRect() {}
  drawImage() {}
  clearRect() {}
}
class Canvas {
  constructor() { this.width = 0; this.height = 0; this.ctx = new Ctx(); }
  getContext() { return this.ctx; }
  toDataURL() { return 'data:image/png;base64,'; }
}
class El {
  constructor(tag) { this.tagName = tag; this.childNodes = []; this.style = {}; this.attributes = {}; this.innerHTML = ''; }
  appendChild(child) { this.childNodes.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = value; this[name] = value; }
  getContext(...args) { return this.canvas.getContext(...args); }
}
const documentStub = {
  documentElement: { tagName: 'html' },
  createElement(tag) { return tag === 'canvas' ? new Canvas() : new El(tag); },
  createElementNS(_ns, tag) { return new El(tag); },
};

function loadQRCode() {
  const global = globalThis;
  global.document = documentStub;
  global.navigator = { userAgent: 'node' };
  global.window = global;
  global.CanvasRenderingContext2D = Ctx;
  const code = readFileSync(new URL('../lib/qrcode.min.js', import.meta.url), 'utf8');
  const QRCode = new Function('global', `${code};return QRCode;`).call(global, global);
  QRCode.prototype.makeImage = () => {};
  return QRCode;
}

function loadJsQR() {
  try {
    const require = createRequire(import.meta.url);
    const loaded = require('../lib/jsQR.min.js');
    return loaded.default || loaded.jsQR || loaded;
  } catch (error) {
    console.warn(`跳过 jsQR 解码：Node 无法加载 vendored jsQR（${error.message}）`);
    return null;
  }
}

function matrixImage(qr, scale = 5) {
  const matrix = qr._oQRCode;
  const quiet = 4;
  const size = (matrix.moduleCount + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  data.fill(255);
  for (let y = 0; y < matrix.moduleCount; y++) for (let x = 0; x < matrix.moduleCount; x++) {
    if (!matrix.isDark(y, x)) continue;
    for (let py = (y + quiet) * scale; py < (y + quiet + 1) * scale; py++) {
      for (let px = (x + quiet) * scale; px < (x + quiet + 1) * scale; px++) data[(py * size + px) * 4 + 3] = 255, data[(py * size + px) * 4] = data[(py * size + px) * 4 + 1] = data[(py * size + px) * 4 + 2] = 0;
    }
  }
  return { data, width: size, height: size };
}

const QRCode = loadQRCode();
const jsQR = loadJsQR();
const cases = [
  'A3|' + '中文混合abc内容def'.repeat(3),
  'A4|' + '😀测试emoji'.repeat(4),
  'A0|' + JSON.stringify({v:1,t:'A',name:'新建文本文档.txt',size:294,pages:6,fps:2,ecc:'L',hash:'sha256:'+'0'.repeat(64)}),
];

for (const value of cases) {
  test(`qrcodejs 编码不溢出：${value.slice(0, 12)}`, () => {
    const box = new El('div');
    const qr = new QRCode(box, { width: 320, height: 320, typeNumber: pickVersion(value, 'L'), correctLevel: QRCode.CorrectLevel.L });
    try { qr.makeCode(value); } catch (error) {
      if (/code length overflow|Too long data/.test(error.message)) throw error;
      // DOM/canvas draw failures are irrelevant; the matrix is already built.
    }
    assert.ok(qr._oQRCode, '应生成 QR 矩阵');
    if (!jsQR) return;
    const image = matrixImage(qr);
    const decoded = jsQR(image.data, image.width, image.height);
    assert.ok(decoded, 'jsQR 应识别矩阵');
    assert.equal(decoded.data.replace(/^\uFEFF/, ''), value);
  });
}
