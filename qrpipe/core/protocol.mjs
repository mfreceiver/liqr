// qrpipe/core/protocol.mjs
export const SEP = '|';

export function isValidTaskId(s) {
  return typeof s === 'string' && s.length === 1 && s >= 'A' && s <= 'Z';
}

export function encodePage(taskId, pageNum, payload) {
  if (!isValidTaskId(taskId)) throw new TypeError(`非法 taskId: ${taskId}`);
  if (!Number.isInteger(pageNum) || pageNum < 0) throw new TypeError(`非法 pageNum: ${pageNum}`);
  if (typeof payload !== 'string') throw new TypeError('payload 必须是字符串');
  return `${taskId}${pageNum}${SEP}${payload}`;
}

export function decodePage(str) {
  if (typeof str !== 'string') return null;
  if (str.length > 0 && str.codePointAt(0) === 0xFEFF) str = str.slice(1); // strip 前导 UTF-8 BOM（qrcodejs 对含中文内容注入 EF BB BF）
  if (str.length === 0) return null;
  const i = str.indexOf(SEP);
  if (i < 0) return null;
  const prefix = str.slice(0, i);
  if (prefix.length < 2) return null;            // 至少 taskId + 1 位页码
  const taskId = prefix[0];
  if (!isValidTaskId(taskId)) return null;
  const pageNum = Number(prefix.slice(1));
  if (!Number.isInteger(pageNum) || pageNum < 0) return null;
  return { taskId, pageNum, payload: str.slice(i + 1) };
}

export function encodeMeta(meta) { return JSON.stringify(meta); }
export function decodeMeta(payload) {
  try { const o = JSON.parse(payload); return (o && typeof o === 'object') ? o : null; }
  catch { return null; }
}
