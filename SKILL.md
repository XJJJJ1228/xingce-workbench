---
name: xingce-workbench
version: 1.1.0
keywords: 行测,公务员,刷题,备考,题库导入,PDF,错题本,PWA
description: 公务员行测学习工作台（纯前端 PWA）。当用户想要「搭建/运行一个行测刷题与备考工作台」「把行测题目/错题/知识点整理进 app」「给行测题库增加栏目、导入 PDF/Word/文本题目」「部署行测刷题应用到手机或公网」时使用。内置五大模块题库、错题本、积累卡片、学习统计，全部数据存于浏览器本地。
---

# 公务员行测学习工作台

一个**零依赖、纯前端**的公务员行测备考工作台：五大模块题库（言语理解 / 判断推理 / 资料分析 / 数量关系 / 常识判断）、错题本（标签 + 二次作答 + 笔记）、积累专区（成语/实词/政治常识/时事卡片）、学习统计与首页看板。数据全部保存在浏览器 `localStorage`，不依赖任何后端。

> 仓库内 `app/` 已自带少量**原创示例题**（非真题，仅演示格式）。真实备考请通过「导入 / 备份」功能加入自己的题目，或用下方**脚本管线**批量导入，或让 AI 助手整理。

## 何时使用本 Skill

- 用户想从零启动/部署一个行测刷题工作台。
- 用户发来题目、错题、知识点，希望自动整理进 app。
- 用户希望给题库增加「栏目」、调整模块/题型、做数据清洗或导入脚本。
- 用户想把 app 部署到手机（PWA 添加到主屏）或公网（静态托管）。
- 用户要导入 PDF 题库（**注意扫描版需先 OCR，见下方管线**）。

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
│   ├── manifest.webmanifest # PWA「添加到主屏幕」配置
│   └── assets/             # 图标 / 截图
├── scripts/                # 题库导入与维护脚本（本 skill 的核心能力）
│   ├── server.js           # 本地静态服务器：node scripts/server.js（默认端口 8756）
│   ├── smoke-test.js       # 冒烟测试（需先 npm i jsdom 并启动 server）
│   ├── extract_pdf.py      # PDF → 纯文本，并自动探测「扫描图片版」
│   ├── parse_xinshuo.py    # 解析「欣说言语刷题集」排版 .txt → .json
│   ├── parse_guoxi.py      # 解析「郭熙100题」排版 .txt → .json
│   ├── ingest.js           # 通用导入：inbox 下 .json/.csv/.txt/.md → bank-custom.js/cards-custom.js
│   └── set_columns.js      # 把数据文件里的 column 字段统一成指定栏目名
├── inbox/                  # 工作目录（导入中间产物）
│   ├── pdf_text/           # extract_pdf.py 输出的 .txt
│   ├── parsed/             # parse_*.py 输出的 .json
│   └── 已处理/             # ingest.js 归档已消费的文件
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

**完整字段、枚举、id 命名规则、文件命名、质量红线**见 `references/schema.md`，生成内容必须严格遵守（尤其：选项用 `A．` 全角点、字符串内禁止未转义单引号、解析要"教方法"而非只给结论、不得照抄受版权保护的大段真题原文）。

> `column` 是真实生效字段：`bank.js` 的 `columnsOf()` 与「专项刷题 → 模块 → 栏目」筛选都依赖它；留空则题目进入综合题库。

模块固定枚举：`言语理解 / 判断推理 / 资料分析 / 数量关系 / 常识判断`。

---

## ⚠️ PDF / 题库导入管线（真实可用，含扫描版兜底）

这是本 skill 与"空壳版"最大的区别：**仓库自带可跑的导入脚本**，而不是只说"让 AI 整理"。
管线分两类，按需选用。

### A. 通用导入（任意格式，最常用）

把题目文件（`.json` / `.csv` / `.txt` / `.md`，或应用内导出的备份）放进 `inbox/`，然后：

```bash
node scripts/ingest.js
```

- 自动识别题干 / 选项 / 答案 / 解析 / 模块 / 题型 / 标签；卡片按「词：释义」行识别。
- **只追加不覆盖**：结果写入 `app/data/bank-custom.js`（题目）与 `app/data/cards-custom.js`（卡片），不改动内置示例题，也不动用户 localStorage。
- 处理完的文件自动移动到 `inbox/已处理/`。

### B. 结构化真题导入（针对特定排版）

适用于「欣说言语刷题集」「郭熙100题」这类**带文字层**的 PDF：

```bash
# 1) 抽取文字层（同时自动探测是否为扫描版）
python scripts/extract_pdf.py path/to/xxx.pdf -o inbox/pdf_text
#    → 若提示「疑似扫描图片版」，说明此 PDF 无文字层，跳到下方 ⚠️ 处理

# 2) 按排版解析（输出 .json 到 inbox/parsed）
python scripts/parse_xinshuo.py --batch          # 欣说（上/下）
python scripts/parse_guoxi.py \
    --q inbox/pdf_text/guoxi_q.txt \
    --a inbox/pdf_text/guoxi_a.txt \
    --out inbox/parsed/guoxi.json                # 郭熙

# 3) 把解析结果固化进题库（ingest.js 也认 .json）
#    把 inbox/parsed/*.json 复制/移动到 inbox/ 后：
node scripts/ingest.js

# 4) （可选）把整份题集合并成一个文件级栏目，便于整刷
node scripts/set_columns.js app/data/bank-xinshuo.js --value "欣说言语刷题集"
```

### ⚠️ 扫描图片版 PDF 必须先用 OCR

`extract_pdf.py` 会统计平均每页有效字符，**低于阈值即判定为扫描版并打印醒目警告**。
扫描版 PDF **没有任何文字层**，`pdfplumber` / `pdftotext` 都抽不出字——本管线无法直接处理。
正确做法（任选其一，转成文字后再走上面管线）：

1. 用 **WPS / Adobe / 微信 / QQ** 的"图片转文字 / 拍照识别"把 PDF 识别成 `.txt`；
2. 或本地部署 OCR：`pip install pymupdf pytesseract` + 安装 `tesseract` 与中文语言包 `chi_sim`，
   渲染页面后再识别（中文扫描件识别质量参差，需人工校对）。

> 经验：带文字层的真题 PDF（如欣说、郭熙）可直接抽取；体积异常大（如 100MB+）或抽取结果为空的，大概率是扫描件。

---

## 用户导入题目（AI 整理）工作流

应用内「导入 / 备份」页支持 **.json / .csv / .txt / .md**，并能按宽松文本规则识别题干、选项、答案、解析；也提供三种模板下载。

当收到用户发来的题目素材（Word/PDF 转文字、网页复制文本、图片 OCR 文本）时：

1. 按 `references/schema.md` 的字段与枚举，把内容归类为五大模块与对应小题型。
2. 格式化为 `window.BANK_DATA.push({...})` 形式，写入 `app/data/bank-custom.js`（用户导入区，不覆盖内置示例题）。
3. 错题自动进错题本、知识点自动进积累专区（由应用逻辑处理，无需手工）。
4. 提醒用户：刷新 app 即可看到新内容；**用户历史学习数据（localStorage）不会丢失**。
5. 校验：用 `node --check app/data/bank-custom.js` 确认语法；如已启动 server，可跑 `node scripts/smoke-test.js`。

> 安全与版权：只整理用户**授权**的内容；真题请做"真题改编/模拟精编"处理，不得原样搬运大段受版权保护的真题原文。

## 常见维护任务

- **加栏目**：给题目对象加 `column: "栏目名"`（展示时 UI 会自动包裹成【栏目名】）；`bank.js` 的 `columnsOf()` 与「专项刷题 → 模块 → 栏目」筛选已支持。批量统一用 `scripts/set_columns.js`。
- **换题/加题**：追加到 `app/data/bank-custom.js`，勿改动内置示例文件以保持可更新。
- **部署到手机**：确保以 http(s) 访问（非 file://），`manifest.webmanifest` 已配置 PWA「添加到主屏幕」。
- **数据备份**：应用内「导入 / 备份 → 导出完整备份」；跨设备用「合并恢复」。

## 依赖与前置

| 用途 | 依赖 | 安装 |
|---|---|---|
| 本地服务 / 冒烟测试 / 导入 | Node.js（含 npm） | 自带 |
| 冒烟测试 `smoke-test.js` | `jsdom` | `npm i jsdom`（首次） |
| PDF 抽取 `extract_pdf.py` | `pdfplumber` | `pip install pdfplumber` |
| 解析脚本 `parse_*.py` | 仅 Python 标准库 | 无需安装 |

## 注意事项

- 数据存浏览器本地，**同一浏览器**才互通；换设备/换浏览器需用备份 JSON 合并导入。
- `file://` 直接打开可能因 Service Worker / 跨域受限，请用本地服务器或静态托管。
- 仓库不含任何真实真题、个人数据或密钥；示例题均为原创。
