// qrpipe/core/paginate.mjs
export const MIN_STEP = 4;

// 按 UTF-8 字节前缀判断单个字符的字节长度
function utf8CharLen(b) {
  if (b < 0x80) return 1;
  if ((b >> 5) === 0b110) return 2;
  if ((b >> 4) === 0b1110) return 3;
  if ((b >> 3) === 0b11110) return 4;
  return 1; // 非法首字节降级为 1（不致死循环）
}

// 逐字符迭代，yield { char, byteLen }；非法 UTF-8 用 U+FFFD 替换字符
export function* utf8Iterate(bytes) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let i = 0;
  while (i < bytes.length) {
    const len = Math.min(utf8CharLen(bytes[i]), bytes.length - i);
    const char = decoder.decode(bytes.subarray(i, i + len));
    yield { char, byteLen: len };
    i += len;
  }
}

export function paginate(bytes, stepBytes) {
  if (!(stepBytes >= MIN_STEP)) {
    throw new RangeError(`stepBytes 必须 >= ${MIN_STEP}`);
  }
  const pages = [];
  let cur = '';
  let curBytes = 0;
  for (const { char, byteLen } of utf8Iterate(bytes)) {
    if (curBytes + byteLen > stepBytes && cur !== '') {
      pages.push(cur);
      cur = char;
      curBytes = byteLen;
    } else {
      cur += char;
      curBytes += byteLen;
    }
  }
  if (cur !== '') pages.push(cur);
  return pages;
}
