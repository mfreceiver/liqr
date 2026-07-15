// qrpipe/core/index.mjs
import { paginate } from './paginate.mjs';
import { encodePage, encodeMeta, decodePage, decodeMeta, isValidTaskId, SEP } from './protocol.mjs';
import { sha256Hex } from './hash.mjs';
import { recommendVersion, maxStepBytes, VMAX, ECC_LEVELS, QR_CAPACITY, estimateTime } from './params.mjs';

export { paginate, encodePage, encodeMeta, decodePage, decodeMeta, isValidTaskId, SEP };
export { sha256Hex, _pureJsSha256Hex } from './hash.mjs';
export { recommendVersion, maxStepBytes, VMAX, QR_CAPACITY, estimateTime };
export { utf8Iterate, MIN_STEP } from './paginate.mjs';

// 构造发送序列：第0页元信息 + 数据页
export async function buildPages(bytes, stepBytes, taskId, { name, fps, ecc }) {
  if (!isValidTaskId(taskId)) throw new TypeError(`非法 taskId: ${taskId}`);
  const hash = 'sha256:' + await sha256Hex(bytes);
  const chunks = paginate(bytes, stepBytes);
  const pages = chunks.length;
  // 空文件 → pages=0；规范要求 pages>=1（至少 1 页）。空文件应由上层拦截，这里保证 pages>=1
  const meta = {
    v: 1, t: taskId, name, size: bytes.length,
    pages: Math.max(1, pages), fps, ecc, hash,
  };
  const metaPage = encodePage(taskId, 0, encodeMeta(meta));
  const dataPages = chunks.map((c, i) => encodePage(taskId, i + 1, c));
  return { meta, metaPage, dataPages, pages: meta.pages, hash };
}

// 接收端拼装：检查缺页 → 顺序拼接 → hash 校验
export async function reassemble(meta, collected) {
  const missing = [];
  for (let p = 1; p <= meta.pages; p++) {
    if (!collected.has(p)) missing.push(p);
  }
  if (missing.length) return { ok: false, missing };
  let text = '';
  for (let p = 1; p <= meta.pages; p++) text += collected.get(p);
  const bytes = new TextEncoder().encode(text);
  const hash = 'sha256:' + await sha256Hex(bytes);
  return { ok: true, bytes, missing: [], hashOk: hash === meta.hash };
}
