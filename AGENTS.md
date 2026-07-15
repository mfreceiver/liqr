# AGENTS.md — QRPipe (personal_projects/liqr)

**QRPipe**：通过二维码动态翻页的单向文件传输套装。发送端（Windows，纯单文件 HTML+JS，双击即用）读取纯文本文件、分段生成二维码、动态翻页；接收端（手机浏览器，HTTPS 托管）用摄像头连续识别、本地拼装还原、校验完整性。数据全程不经过互联网。

- 中文工作环境；代码用英文标识符，UI 文案与注释用中文。
- 纯 JavaScript (ESM) + HTML；无 lint / build 约定（不打包，HTML 直接引用同目录 `lib/` 与内联 core）。
- 测试：Node v20 内置 `node --test`，测试文件置于 `qrpipe/test/*.test.mjs`。项目验证命令：`node --test qrpipe/test/`。
- 二维码库源码置于 `qrpipe/lib/`（qrcodejs 生成、jsQR 解析），不从 CDN 加载。
- 数据隐私硬约束：接收端识别与文件内容全程在手机浏览器本地处理（getUserMedia + jsQR + IndexedDB），绝不回传互联网。
- ocmar 工作流产物：`docs/ocmar/`（specs / plans / reports）；ledger 与执行产物在 `.ocmar/workflows/<slug>/`（git-ignored）。

## 关键设计约束（详见 docs/ocmar/specs/）

- 协议：统一二维码字符串 `<任务序号1位A-Z><页码>|<载荷>`；页码 0=元信息(JSON)，≥1=内容片段；按第一个 `|` 分割。
- 分页：近似字节（步长 ≥4）+ 不切断 UTF-8 字符，确定性可复现（同文件+同步长+同任务序号=相同二维码序列）。
- 二维码版本上限 VMAX=10；hash=SHA-256（对原始字节）。
- 已知限制：发送端 qrcodejs 用 `charCodeAt`，emoji（BMP 外代理对）会传输失败（纯文本不含 emoji 时无影响）。
