# 和而不同 · 和议书（HeYi OS）

一个把不同需求转化为共同合作规则的网站：案例选择 → 共享画像与讨论 → 动态差异地图 → 方案协商 → 和议书制作与三方确认 → 承诺追踪。

**已完成的网站源码在 [`heyi-os/`](heyi-os/)，完整安装及使用说明见 [`heyi-os/README.md`](heyi-os/README.md)。**

## 下载后运行

需要 Node.js 24（包含 npm）。有仓库权限的用户可使用 **Code → Download ZIP**，解压后在项目中打开终端；也可克隆仓库。在仓库根目录执行：

```sh
cd heyi-os
npm ci
npm run setup
npm start
```

浏览器打开 **http://127.0.0.1:5173**。本地运行不需要 Codex 或 Cloudflare 账号。AI 是可选功能：使用时按子目录说明配置自己的 ACCTOKEN 密钥，仓库不附带作者的额度或密钥。

## 项目材料

- [当前网站源码与使用说明](heyi-os/README.md)
- [Demo 完整录制脚本与示例对话](heyi-os/docs/和议书-Demo录制说明.md)
- [Demo 现场速查](heyi-os/docs/和议书-Demo现场速查.md)
- [本次分发验收记录](heyi-os/docs/VALIDATION.md)
- `Group Presentation 1002.pdf`：原始课程材料，保持原样。
- `PRD-和而不同.md`：早期方案材料，保持原样；其中游戏化、双供应商、全英文等设想不代表当前已交付版本。当前功能以 `heyi-os/` 源码和说明为准。

仓库保持私有，下载者需被授予访问权限。角色切换属于演示机制，不是登录权限系统；不要把当前本地版本直接开放公网或录入敏感数据。项目是全栈应用，不能仅靠 GitHub Pages 运行。
