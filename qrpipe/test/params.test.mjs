// qrpipe/test/params.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QR_CAPACITY, VMAX, ECC_LEVELS, maxStepBytes, estimateTime, recommendVersion, pickVersion } from '../core/params.mjs';

test('T4-C1 容量锚点值', () => {
  assert.equal(QR_CAPACITY[10].M, 213);
  assert.equal(QR_CAPACITY[1].L, 17);
});
test('T4-C2 maxStepBytes', () => {
  assert.equal(maxStepBytes(10, 'M', 2), 209);
});
test('T4-C3 estimateTime', () => {
  assert.equal(estimateTime(10, 2), 5);
  assert.equal(estimateTime(10, 0), null);
});
test('T4-C4 recommendVersion 正常', () => {
  assert.equal(recommendVersion(150, 'M', 2), 9);
});
test('T4-C5 recommendVersion 超限', () => {
  assert.equal(recommendVersion(300, 'M', 2), null);
});
test('T4-C6 容量单调递增', () => {
  for (let v = 1; v < VMAX; v++) {
    for (const e of ECC_LEVELS) assert.ok(QR_CAPACITY[v][e] <= QR_CAPACITY[v+1][e], `V${v}.${e}`);
  }
});
test('pickVersion 按 charCodeAt 口径选版（精确匹配 qrcodejs createData，含 astral）', () => {
  const QRc = {1:{L:17,M:14,Q:11,H:7},2:{M:26},3:{M:42},4:{M:62},5:{M:84},6:{M:106},7:{M:122},8:{M:152},9:{M:180},10:{M:213}};
  const cb = V => V<10?8:16;
  // 复刻 qrcodejs charCodeAt parsedData
  function parsed(s){ let n=0; for(let i=0;i<s.length;i++){const f=s.charCodeAt(i); if(f>65536)n+=4; else if(f>2048)n+=3; else if(f>128)n+=2; else n+=1;} if(n!==s.length)n+=3; return n; }
  function fits(s,V,ecc){ return 4+cb(V)+8*parsed(s) <= 8*QRc[V][ecc]; }
  const cases = [];
  for (let n=1;n<=80;n++) cases.push('A'.repeat(n));
  for (let n=1;n<=80;n++) cases.push('A12|'+'中'.repeat(n));          // BMP 中文
  for (let n=1;n<=40;n++) cases.push('B3|'+'😀'.repeat(n));           // astral emoji (6B/char via charCodeAt)
  for (let n=1;n<=40;n++) cases.push('C4|'+'𠮷'.repeat(n));           // astral CJK Ext B
  for (const s of cases){
    const V = pickVersion(s, 'M');
    if (V===null){ assert.ok(!fits(s,10,'M'), 'null but fits V10: '+s.length); }
    else { assert.ok(fits(s,V,'M'), 'chosen V='+V+' overflows: len='+s.length); assert.ok(V===1||!fits(s,V-1,'M'), 'not minimal V='+V); }
  }
});
test('pickVersion astral 内容被正确识别为更大版本（emoji 不再被低估）', () => {
  // emoji x30 = 60 代理 ×3B + 3BOM = 183B parsedData → V10（旧 TextEncoder 口径会算成 123B 误选 V8 → overflow）
  assert.equal(pickVersion('😀'.repeat(30), 'M'), 10);
  assert.equal(pickVersion('😀'.repeat(60), 'M'), null);   // 363B 超 V10
  assert.equal(pickVersion('中'.repeat(60), 'M'), 10);     // BMP 180B+3BOM
});
test('pickVersion 超 VMAX 返回 null', () => {
  assert.equal(pickVersion('A'.repeat(400), 'M'), null);   // 远超 V10
});
test('pickVersion 各 ECC 均不自相矛盾', () => {
  const QRc = {L:{1:17,2:32,3:53,4:78,5:106,6:134,7:154,8:192,9:230,10:271},M:{1:14,2:26,3:42,4:62,5:84,6:106,7:122,8:152,9:180,10:213},Q:{1:11,2:20,3:32,4:46,5:66,6:86,7:108,8:130,9:150,10:151},H:{1:7,2:14,3:24,4:34,5:44,6:60,7:74,8:86,9:98,10:119}};
  // 复刻 qrcodejs charCodeAt parsedData（与 core/params.mjs._qrParsedBytes 一致）
  function parsed(s){ let n=0; for(let i=0;i<s.length;i++){const f=s.charCodeAt(i); if(f>65536)n+=4; else if(f>2048)n+=3; else if(f>128)n+=2; else n+=1;} if(n!==s.length)n+=3; return n; }
  for (const ecc of ['L','M','Q','H']){
    for (let n=1;n<=260;n++){
      const s = 'B5|' + '中'.repeat(n);
      const V = pickVersion(s, ecc);
      if (V===null) continue;
      const need = 4 + (V<10?8:16) + 8*parsed(s);
      assert.ok(need <= 8*QRc[ecc][V], `ecc=${ecc} n=${n} V=${V} overflow`);
    }
  }
});
