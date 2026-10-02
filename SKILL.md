---
name: xingce-workbench
description: 公务员行测学习工作台（纯前端 PWA）。当用户想要「搭建/运行一个行测刷题与备考工作台」「把行测题目/错题/知识点整理进 app」「给行测题库增加栏目、导入 PDF/Word/文本题目」「部署行测刷题应用到手机或公网」时使用。内置五大模块题库、错题本、积累卡片、学习统计，全部数据存于浏览器本地。
---

# 公务员行测学习工作台

一个**零依赖、纯前端**的公务员行测备考工作台：五大模块题库（言语理解 / 判断推理 / 资料分析 / 数量关系 / 常识判断）、错题本（标签 + 二次作答 + 笔记）、积累专区（成语/实词/政治常识/时事卡片）、学习统计与首页看板。数据全部保存在浏览器 `localStorage`，不依赖任何后端。

> 仓库内 `app/` 已自带少量**原创示例题**（非真题，仅演示格式）。真实备考请通过「导入 / 备份」功能加入自己的题目，或让 AI 助手整理。

## 何时使用本 Skill

- 用户想从零启动/部署一个行测刷题工作台。
- 用户发来题目、错题、知识点，希望自动整理进 app。
- 用户希望给题库增加「栏目」、调整模块/题型、做数据清洗或导入脚本。
- 用户想把 app 部署到手机（PWA 添加到主屏）或公网（静态托管）。

## 项目结构

```
xingce-workbench/
├── SKILL.md                 # 本文件
├── README.md                # 面向人类的使用与部署说明
├── LICENSE                 # MIT
├── app/                    # 可直接托管的静态站点
│   ├── index.html
│   ├── css/style.css
│   ├── js/                 # store / bank / ui / 各视图
│   ├── data/               # 题库(bank-*.js) 与卡片(cards-*.js)
│   ├── manifest.webmanifest
│   ├── sw.js               # Service Worker（PWA / 离线）
│   └── assets/             # 图标
├── scripts/
│   ├── server.js           # 本地静态服务器：node scripts/server.js
│   └── smoke-test.js       # 冒烟测试（需先 npm i jsdom 并启动 server）
└── references/
    └── schema.md           # 题目/卡片数据规范（强约束）
```

## 如何运行

```bash
# 1) 启动本地静态服务器（默认端口 8756）
node scripts/server.js
# 浏览器打开 http://localhost:8756

# 2) 冒烟测试（可选，检测运行时错误）
npm i jsdom            # 仅首次
node scripts/smoke-test.js
```

也可直接把 `app/` 目录部署到任意静态托管（GitHub Pages / Nginx / 云沙箱），无需构建步骤。

## 数据模型（强约束）

所有题目/卡片为纯 JS 文件，格式：

```js
window.BANK_DATA = window.BANK_DATA || [];
window.BANK_DATA.push({ id, module, type, subtype, difficulty, stem, options, answer, analysis, tags, passage, groupId, column, source });
```

卡片：

```js
window.CARD_DATA = window.CARD_DATA || [];
window.CARD_DATA.push({ id, category, title, summary, detail, example, confuse, tags, star });
```

**完整字段、枚举、id 命名规则、文件命名、质量红线**见 `references/schema.md`，生成内容必须严格遵守（尤其：选项用 `A．` 全角点、字符串内禁止未转义单引号、解析要“教方法”而非只给结论、不得照抄受版权保护的大段真题原文）。

模块固定枚举：`言语理解 / 判断推理 / 资料分析 / 数量关系 / 常识判断`。

## 用户导入题目（AI 整理）工作流

应用内「导入 / 备份」页支持 **.json / .csv / .txt / .md**，并能按宽松文本规则识别题干、选项、答案、解析；也提供三种模板下载。

当收到用户发来的题目素材（Word/PDF 转文字、网页复制文本、图片 OCR 文本）时：

1. 按 `references/schema.md` 的字段与枚举，把内容归类为五大模块与对应小题型。
2. 格式化为 `window.BANK_DATA.push({...})` 形式，写入 `app/data/bank-custom.js`（用户导入区，不覆盖内置示例题）。
3. 错题自动进错题本、知识点自动进积累专区（由应用逻辑处理，无需手工）。
4. 提醒用户：刷新 app 即可看到新内容；**用户历史学习数据（localStorage）不会丢失**。
5. 校验：用 `node --check app/data/bank-custom.js` 确认语法；如已启动 server，可跑 `node scripts/smoke-test.js`。

> 安全与版权：只整理用户**授权**的内容；真题请做“真题改编/模拟精编”处理，不得原样搬运大段受版权保护的真题原文。

## 常见维护任务

- **加栏目**：给题目对象加 `column: "栏目名"`（展示时 UI 会自动包裹成【栏目名】）；`bank.js` 的 `columnsOf()` 与「专项刷题 → 模块 → 栏目」筛选已支持。
- **换题/加题**：追加到 `app/data/bank-custom.js`，勿改动内置示例文件以保持可更新。
- **部署到手机**：确保以 http(s) 访问（非 file://），`manifest.webmanifest` + `sw.js` 已配置 PWA「添加到主屏幕」。
- **数据备份**：应用内「导入 / 备份 → 导出完整备份」；跨设备用「合并恢复」。

## 注意事项

- 数据存浏览器本地，**同一浏览器**才互通；换设备/换浏览器需用备份 JSON 合并导入。
- `file://` 直接打开可能因 Service Worker / 跨域受限，请用本地服务器或静态托管。
- 仓库不含任何真实真题、个人数据或密钥；示例题均为原创。
