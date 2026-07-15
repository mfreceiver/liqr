// qrpipe/core/params.mjs
export const VMAX = 10;
export const ECC_LEVELS = ['L', 'M', 'Q', 'H'];

// QR 字节模式（8-bit byte）容量表，Version 1..10（ISO/IEC 18004 / thonky 参考）
export const QR_CAPACITY = {
  1:  { L:17,  M:14,  Q:11,  H:7   },
  2:  { L:32,  M:26,  Q:20,  H:14  },
  3:  { L:53,  M:42,  Q:32,  H:24  },
  4:  { L:78,  M:62,  Q:46,  H:34  },
  5:  { L:106, M:84,  Q:66,  H:44  },
  6:  { L:134, M:106, Q:86,  H:60  },
  7:  { L:154, M:122, Q:108, H:74  },
  8:  { L:192, M:152, Q:130, H:86  },
  9:  { L:230, M:180, Q:150, H:98  },
  10: { L:271, M:213, Q:151, H:119 },
};

// 单步内容字节上限 = 容量 − 协议开销(taskId 1 + 页码位数 + 分隔符 1)
export function maxStepBytes(versionMax, ecc, pageDigits) {
  const cap = QR_CAPACITY[versionMax]?.[ecc];
  if (cap == null) throw new RangeError(`非法 version/ecc: ${versionMax}/${ecc}`);
  return cap - (1 + pageDigits + 1);
}

// 总传输时间（秒）；fps=0 手动模式返回 null
export function estimateTime(pages, fps) {
  if (!fps) return null;
  return pages / fps;
}

// 推荐所需最小版本；超 VMAX 返回 null
export function recommendVersion(stepBytes, ecc, pageDigits) {
  for (let v = 1; v <= VMAX; v++) {
    if (maxStepBytes(v, ecc, pageDigits) >= stepBytes) return v;
  }
  return null;
}

// 内部：QR 8-bit 字节模式的字符计数指示符位数（V<10 为 8，V>=10 为 16）
function _qrCountBits(version){ return version < 10 ? 8 : 16; }

// 选择能容纳该二维码字符串的最小 QR 版本（1..VMAX）；超 VMAX 返回 null。
// 精确匹配 qrcodejs createData 的容量约束：getLengthInBits = 4(mode) + countBits + 8·parsedData。
//   - parsedData = 该字符串的 UTF-8 字节数 + (含非 ASCII 时 qrcodejs 注入的 3 字节 BOM)。
//   - 这规避了 qrcodejs 自动选版（r 函数）忽略 mode/count 开销导致的 code length overflow。
// 传入的 str 是完整二维码字符串（如 'A12|<内容>'），ecc 为 'L'/'M'/'Q'/'H'。
const _utf8Encoder = new TextEncoder();
export function pickVersion(str, ecc){
  const bytes = _utf8Encoder.encode(str).length;
  const bom = bytes > str.length ? 3 : 0;   // 含非 ASCII → qrcodejs 注入 3 字节 BOM
  for (let version = 1; version <= VMAX; version++){
    const needBits = 4 + _qrCountBits(version) + 8 * (bytes + bom);
    if (needBits <= 8 * QR_CAPACITY[version][ecc]) return version;
  }
  return null;
}
