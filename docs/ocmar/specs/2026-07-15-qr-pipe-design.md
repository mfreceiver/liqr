# liqr — QR 二维码翻页文件传输套装 · 设计规格 (spec)

- **日期**: 2026-07-15
- **状态**: 已与用户对齐，待 review
- **原始一句话需求**: 生成一个简易文件传输工具：发送端运行在 Windows 上，读取纯文本文件并分段转成二维码动态翻页发送；接收端是手机网页，连续识别二维码还原文件。

---

## 1. 目标与范围

### 1.1 目标
单向文件传输：**Windows PC → 手机**，通过二维码动态翻页。发送端读取纯文本文件、分段生成二维码、翻页发送；接收端用手机摄像头连续识别、按页收集、拼装还原、校验完整性。

### 1.2 范围约束（已对齐）
- **文件类型**：纯文本（UTF-8），主要为中文/英文混合文本
- **文件规模**：小文件（几 KB 以内）。系统参数化，可适应更大文件但默认面向此规模
- **数据隐私（硬约束）**：摄像头识别与文件内容**全程在手机浏览器本地处理，不经过互联网**；公网 HTTPS 仅用于托管静态网页文件
- **减少依赖（硬约束）**：发送端为纯单文件 HTML+JS，双击浏览器打开即用，无需安装任何软件；二维码生成/解析所需的第三方 JS 库**源码内嵌**进单文件 HTML，不依赖 CDN

### 1.3 非目标（YAGNI，明确不做）
- 加密（二维码本身可见，端到端加密意义有限；如需可后加）
- 云端数据持久化/同步（全本地）
- 大文件流式分块（几百 KB+，二维码翻页方案对大文件不实用）
- 多文件批量传输（一次一个任务）
- 发送端原生 GUI 窗口（纯网页即可）
- 拍照上传模式（连续识别已满足需求；保留为可选后续增强）

---

## 2. 已对齐的核心决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 字符编码与分页粒度 | **近似字节分页 + 不切断字符**：步长为"约 N 字节"，按 code point 迭代累计字节数，加入下一字符会超 N 则切页。每页完整字符、字节数 ≤ N、尽量贴近 N |
| 2 | 发送端技术形态 | **纯单文件 HTML+JS**：双击用浏览器（Edge/Chrome）打开，全部逻辑用 JS 完成 |
| 3 | 接收端打开与识别方式 | **公网 HTTPS 托管 + 连续识别**：手机访问网址，`getUserMedia` 调摄像头连续扫描，`jsQR` 本地解析。数据不经过互联网 |
| 4 | 典型文件规模 | **小文件（几 KB 内）** |

**测试工具链**：Node v20.19.4（内置 `node --test`，无需额外测试框架）+ Python 3.14。core 逻辑用纯 JS/ESM 编写，Node 与浏览器共用，核心逻辑用 `node --test` 单测。

---

## 3. 架构

### 3.1 三块结构
1. **`core/`（纯 JS/ESM 模块，无依赖）** — 分页、协议编解码、hash、参数计算。浏览器与 Node 共用。
2. **`sender.html`（发送端单文件）** — UI + 二维码渲染（内嵌 qrcode 生成库源码）。
3. **`receiver.html`（接收端单文件）** — 摄像头扫描 + 本地解析 + 收集 + 校验（内嵌 jsQR 源码）。

### 3.2 模块职责与边界

**`core/protocol.mjs`** — 协议编解码
- `encodePage(taskId, pageNum, payload)` → 二维码字符串
- `decodePage(qrString)` → `{ taskId, pageNum, payload }` 或 `null`（非法）
- `encodeMeta(meta)` / `decodeMeta(payload)` → 元信息页 JSON 编解码
- 无 DOM、无 Node 专属 API，浏览器与 Node 均可 import

**`core/paginate.mjs`** — 确定性分页
- `paginate(utf8Bytes: Uint8Array, stepBytes: number)` → `string[]`（每页内容字符串）
- `utf8Iterate(bytes)` → 产出 `{ char, byteLen }` 序列的迭代器（用于不切断字符）

**`core/hash.mjs`** — SHA-256
- `sha256Hex(bytes: Uint8Array)` → 64 位 hex 字符串
- Node 用 `crypto`，浏览器用 `crypto.subtle`（见 §10 注意事项）

**`core/params.mjs`** — 参数与限制计算
- `QR_CAPACITY[version][ecc]` 容量查表（QR 规范字节模式）
- `maxStepBytes(versionMax, ecc, pageDigits)` → 单步内容字节上限
- `estimateTime(pages, fps)` → 总传输秒数
- `recommendVersion(stepBytes, ecc)` → 计算所需 QR 版本

**`core/crc` 不需要**（hash 校验完整性，无 CRC）。

**`sender.html`** — 调用 core 模块 + `<input type=file>` 选文件 + qrcode 库渲染 + 自动/手动翻页 + 重传 UI。

**`receiver.html`** — 调用 core 模块 + `getUserMedia` + `jsQR` 解析 + IndexedDB 存储 + 进度/缺页 UI + 拼装校验 + 下载。

---

## 4. 数据协议（两端共享契约 ⭐）

### 4.1 统一数据页格式
```
<T><P>|<PAYLOAD>
```
- **`T`**：任务序号，恰好 1 个字符，`A`–`Z`（26 个任务空间）
- **`P`**：页码，十进制变长正整数或 0
  - `0` = 任务元信息页（第 0 页）
  - `1..pages` = 数据页
- **`|`**：分隔符（U+007C），整个二维码字符串中**第一个出现的 `|`** 作为元信息/载荷的分隔符
- **`PAYLOAD`**：
  - `P=0`：JSON 元信息字符串（见 §4.2）
  - `P≥1`：该页文件内容片段（原文 UTF-8 字符串）

### 4.2 第 0 页（元信息页）载荷：JSON
```json
{
  "v": 1,
  "t": "A",
  "name": "notes.txt",
  "size": 1234,
  "pages": 12,
  "fps": 2,
  "ecc": "M",
  "hash": "sha256:64位hex..."
}
```
| 字段 | 类型 | 说明 |
|------|------|------|
| `v` | int | 协议版本，当前 `1` |
| `t` | string | 任务序号（1 位大写字母，与数据页 `T` 一致） |
| `name` | string | 文件名（JSON 转义处理特殊字符） |
| `size` | int | 文件原始字节数 |
| `pages` | int | 总数据页数（`≥1`；不含第 0 页） |
| `fps` | number | 翻页频率（张/秒）；`0` 表示手动翻页 |
| `ecc` | string | 纠错级别 `"L"`/`"M"`/`"Q"`/`"H"` |
| `hash` | string | `"sha256:"` + 64 位 hex，对文件**原始字节**计算 |

### 4.3 解析规则（接收端）
1. 在二维码字符串中找到第一个 `|` 的索引 `i`
2. `prefix = str[0..i)`，`payload = str[i+1..)`
3. `T = prefix[0]`，`P = parseInt(prefix.slice(1))`
4. 载荷类型由 `P` 决定：`P=0` → JSON 元信息；`P≥1` → 内容片段
5. **健壮性**：文件内容中即使含 `|` 也不影响，因为只切第一个 `|`；`prefix` 中 `T` 恒为首字符，`P` 恒为纯数字

### 4.4 协议版本
当前 `v=1`。接收端解析元信息页时校验 `v`，版本不兼容则提示。

---

## 5. 分页规则

### 5.1 近似字节分页 + 不切断字符（确定性）
```
paginate(bytes, stepBytes):
  pages = []
  cur = ""        // 当前页累积的字符串
  curBytes = 0
  for {cp, byteLen} in utf8Iterate(bytes):   // 按 code point 迭代
    if curBytes + byteLen > stepBytes and cur != "":
      pages.push(cur)
      cur = cp; curBytes = byteLen          // 新起一页
    else:
      cur += cp; curBytes += byteLen
  if cur != "": pages.push(cur)
  return pages
```

### 5.2 确定性与可复现
- 分页结果**只取决于** `bytes`（文件字节）与 `stepBytes`（步长），与频率、时间、任务序号无关
- 任务序号只影响每页 `T` 前缀，不影响内容分页
- 因此：**同文件 + 同步长 + 同任务序号 → 完全相同的二维码序列**，满足隔日补传可复现

### 5.3 步长约束
- **最小步长 = 4**（UTF-8 单字符最多 4 字节）。步长 < 4 时系统拒绝并提示
- 若某单个字符 `byteLen > stepBytes`（仅当步长 < 该字符字节长度），该字符单独成页，单页字节超过步长——通过最小步长 4 规则规避绝大多数情况；emoji 等特殊 4 字节字符在步长 ≥ 4 时正常

---

## 6. 参数与限制

### 6.1 可配参数（发送端）
| 参数 | 含义 | 默认值 |
|------|------|--------|
| `stepBytes` | 步长（每次读取的目标字节数，`≥4`） | 150 |
| `fps` | 翻页频率（张/秒），`0`=手动 | 2 |
| `ecc` | 容错率 = 二维码纠错级别 `L`/`M`/`Q`/`H` | `M` |
| `taskId` | 任务序号（1 位 `A`–`Z`） | 用户指定 |

### 6.2 二维码版本上限与单步最大字节
- **版本上限 `Vmax = 10`**（57×57 模块），避免过大尺寸难展示/难识别
- QR 字节模式容量（Version 10，标准值）：
  - `L`: 271，`M`: 213，`Q`: 151，`H`: 119 字节
- core 内置完整容量查表（Version 1–10），`maxStepBytes(Vmax, ecc, pageDigits) = QR_CAPACITY[Vmax][ecc] - (1 + pageDigits + 1)`
  - 协议开销 = `T`(1) + 页码数字位数 `pageDigits` + `|`(1)
  - `pageDigits` 由总页数 `pages` 的位数决定（发送前已知）
- 系统校验：若用户 `stepBytes` 超过单步内容字节上限 → 警告并建议降低步长或 ecc，或由用户选择自动收紧

### 6.3 时间预估
- `totalSeconds = pages / fps`（`fps > 0`）
- 第 0 页（元信息页）停留时间单独计：固定 2 秒 或 手动确认（与 `fps` 无关）
- 手动模式（`fps=0`）：不预估，提示"手动翻页"

---

## 7. 发送端（sender.html）

### 7.1 交互流程
1. 用户选择文件（`<input type=file>`）+ 设置参数（步长/fps/ecc/任务序号）
2. 系统读取文件（`FileReader`/`arrayBuffer`），计算：
   - 字节数 `size`、SHA-256
   - 分页 `pages`（core/paginate）
   - 页码位数、单步内容字节上限、所需 QR 版本
   - 总传输时间 `estimateTime`
3. 显示**参数概要**：文件名、大小、总页数、单步字节、QR 版本、ecc、fps、总时间、hash。**用户确认后**才进入传输
4. 展示**第 0 页**（元信息页）：固定停留 2 秒 或 手动确认翻页
5. 按 `fps` **自动翻页**或用户**手动翻页**（按键/点击），展示第 1..pages 页
6. 末页后**停止**

### 7.2 翻页模式
- 自动：`setInterval` 按 `1/fps` 秒切换页面
- 手动：用户按键/点击切换
- 两种模式下，**同一页的二维码内容完全相同**（翻页方式不影响二维码）

### 7.3 重传 / 补传模式
- 传输完成后，允许用户**输入待重传页码**（单个或多个），重传对应页（同任务序号、同内容，确定性）
- 支持**直接进入补传模式**：跳过正常传输，直接输入页码（或页码范围）逐页发送
- 因分页确定性，重传页内容与首次一致，满足隔日补传

---

## 8. 接收端（receiver.html）

### 8.1 交互流程
1. 打开网页（HTTPS 托管），请求摄像头权限，`getUserMedia({video:{facingMode:'environment'}})` 启动后置摄像头
2. `<video>` + `canvas` 按帧截取，`jsQR` 本地解析二维码
3. 解析到**页码 0** → 存任务元信息（按 `taskId` 维度），更新 UI（文件名/大小/总页数/fps/hash）
4. 解析到**页码 ≥1** → 存入 `(taskId, pageNum)` 槽（覆盖重复帧）
5. UI 显示进度：已收页码集合、缺页列表、完成度
6. 当某任务所有 `1..pages` 页齐备 → 按页码顺序**拼装**内容 → 计算 SHA-256 → 与第 0 页 `hash` 比对
7. **校验通过** → 提供下载（`Blob` + `<a download>`）/直接显示文本；**校验失败** → 报告（缺页/损坏页），提示发送端重传

### 8.2 数据持久化
- 元信息与已收页存 **IndexedDB**（按 `taskId` 分库）
- 支持隔日补传：用户隔日用相同任务序号重传缺页，接收端持续累积直至齐全

### 8.3 缺页处理
- 实时高亮缺页页码
- 允许用户在 UI 上标记"需要重传的页"，导出页码列表给发送端（或发送端手动输入）

---

## 9. 依赖策略

| 组件 | 依赖 | 处理 |
|------|------|------|
| `core/*` | 无 | 纯 JS/ESM，零依赖 |
| sender 二维码生成 | qrcode 生成库（如 `davidshimjs/qrcodejs` 或 npm `qrcode` 的浏览器版） | **源码内嵌**进 sender.html |
| receiver 二维码解析 | `jsQR` | **源码内嵌**进 receiver.html |
| 测试 | Node 内置 `node --test`、`node:crypto` | 无需安装 |

实现真正零安装、零网络运行时依赖（HTTPS 托管的 receiver 仅加载自身静态文件）。

---

## 10. 错误处理

| 场景 | 处理 |
|------|------|
| 文件为空（size=0） | 拒绝，提示 |
| 步长 < 4 | 拒绝，提示最小步长 4 |
| 步长 + ecc 超出 QR Vmax 单步上限 | 警告 + 建议降步长/ecc，或自动收紧 |
| 文件名含特殊字符/中文 | JSON 转义，正常处理 |
| 任务序号非 A–Z | 拒绝，提示 |
| 浏览器不支持 `getUserMedia` | 接收端提示不支持 + 降级说明 |
| 摄像头权限拒绝 | 提示重新授权 |
| 接收端缺页 | 列出缺页，等待/提示重传 |
| hash 不匹配 | 报告，列出缺页/可疑页，不提供下载 |
| 浏览器 `crypto.subtle` 不可用（file:// 发送端） | 发送端 hash 降级：优先 `crypto.subtle`，不可用则用纯 JS SHA-256（core 内置 fallback），保证 file:// 可用 |

---

## 11. 测试策略（方向，具体 task 测试在 plan 阶段定）

**core 模块（`node --test` 单测）**：
- 分页确定性（同输入同输出）、不切断 UTF-8 字符、边界（步长=4、含中文/emoji、空文件）
- 协议编解码对称（`encodePage`/`decodePage`、`encodeMeta`/`decodeMeta`）
- 协议健壮性（载荷含 `|`、含中文、页码变长）
- SHA-256 正确性（对已知向量）
- 参数计算（QR 版本推荐、单步上限、时间预估）

**端到端（Node 脚本 + 浏览器手动）**：
- 发送端对示例文件生成第 0 页 + 数据页二维码字符串序列 → 模拟接收端 `decodePage` 收集 → 拼装 → 校验 hash 通过
- 可复现性：同文件+同步长+同任务序号重复生成，序列逐字节相同

**浏览器层（手动验证）**：
- sender.html 在 Edge/Chrome 双击打开，选文件→确认→翻页正常
- receiver.html 在 HTTPS 下摄像头连续识别可用（jsQR 解析真实二维码）

---

## 12. 成功标准（可验证）

| # | 标准 | 验证方式 |
|---|------|----------|
| SC1 | core 分页确定性：同文件+同步长 → 同分页；每页字节数 ≤ 步长且不切断 UTF-8 字符 | node --test 单测 |
| SC2 | core 协议编解码对称：`decode(encode(x)) == x`，载荷含 `\|`/中文/变长页码均正确 | node --test 单测 |
| SC3 | 端到端：sender 生成的二维码序列经 receiver 解析拼装后，内容字节与原文件一致且 SHA-256 匹配 | Node 脚本模拟两端 |
| SC4 | 可复现/隔日补传：同文件+同步长+同任务序号重复生成，二维码序列逐位相同 | node --test / 脚本 |
| SC5 | 接收端检测缺页并提示；齐全后校验 hash，失败则拒绝下载 | node --test（拼装/校验逻辑） |
| SC6 | sender.html 双击在浏览器可用；receiver.html 在 HTTPS 下连续识别可用 | 浏览器手动验证 |

---

## 13. 文件结构（初步）

```
liqr/
  core/
    protocol.mjs      # 协议编解码
    paginate.mjs      # 确定性分页
    hash.mjs          # SHA-256（subtle + 纯 JS fallback）
    params.mjs        # QR 容量查表、单步上限、时间预估、版本推荐
    index.mjs         # 统一导出
  sender.html         # 发送端单文件（内嵌 qrcode 库）
  receiver.html       # 接收端单文件（内嵌 jsQR）
  test/
    protocol.test.mjs
    paginate.test.mjs
    hash.test.mjs
    params.test.mjs
    e2e.test.mjs      # 端到端模拟
  lib/                # 内嵌用的库源码（构建时注入 html，或开发期引用）
    qrcode.min.js
    jsQR.min.js
```

> 具体文件清单在 plan 阶段细化为 task。
