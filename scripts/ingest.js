/* ============================================================
 * ingest.js —— 把 inbox 目录里的题目 / 知识点自动整理进 app
 * 用法：node scripts/ingest.js
 * 支持 .json / .csv / .txt / .md
 * 整理结果写入 app/data/bank-custom.js（题目）与 app/data/cards-custom.js（卡片）
 * 只会追加，不会覆盖，也不会动用户的学习数据
 * ========================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INBOX = path.join(ROOT, "inbox");
const BANK_FILE = path.join(ROOT, "app", "data", "bank-custom.js");
const CARD_FILE = path.join(ROOT, "app", "data", "cards-custom.js");

/* ---------- 读取已有数据 ---------- */
function loadJsArray(file) {
  global.window = global.window || {};
  if (fs.existsSync(file)) {
    try { eval(fs.readFileSync(file, "utf8")); } catch (e) { console.warn("读取失败", file, e.message); }
  }
  return (global.window && global.window.BANK_DATA) || [];
}
function loadCards(file) {
  global.window = global.window || {};
  if (fs.existsSync(file)) {
    try { eval(fs.readFileSync(file, "utf8")); } catch (e) { }
  }
  return (global.window && global.window.CARD_DATA) || [];
}

/* ---------- 解析 ---------- */
function parseBlocks(text) {
  const blocks = text.split(/\n\s*\n+/);
  const out = [];
  let lastPassage = "";
  blocks.forEach((b) => {
    const lines = b.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const stemLines = [], options = {}, analysisLines = [];
    let answer = "", module = "", type = "", tags = [], inAnalysis = false;
    lines.forEach((ln) => {
      let m;
      if ((m = ln.match(/^(?:答案|正确答案|【答案】)\s*[:：]?\s*([A-Da-d])/))) { answer = m[1].toUpperCase(); inAnalysis = false; return; }
      if ((m = ln.match(/^(?:解析|【解析】)\s*(.*)$/))) { inAnalysis = true; if (m[1]) analysisLines.push(m[1]); return; }
      if (inAnalysis) { analysisLines.push(ln); return; }
      if ((m = ln.match(/^(?:模块|科目)\s*[:：]\s*(.+)$/))) { module = m[1].trim(); return; }
      if ((m = ln.match(/^(?:题型)\s*[:：]\s*(.+)$/))) { type = m[1].trim(); return; }
      if ((m = ln.match(/^(?:标签|知识点)\s*[:：]\s*(.+)$/))) { tags = splitArr(m[1]); return; }
      if ((m = ln.match(/^\s*([A-D])[．.、:：)\s]\s*(.+)$/))) { options[m[1].toUpperCase()] = m[1].toUpperCase() + "．" + m[2].trim(); return; }
      if (/^(?:材料|根据以下)/.test(ln) || /\|/.test(ln)) { lastPassage += (lastPassage ? "\n" : "") + ln; return; }
      stemLines.push(ln);
    });
    const opts = ["A", "B", "C", "D"].map((k) => options[k]).filter(Boolean);
    const stem = stemLines.join("\n");
    if (stem && opts.length >= 2) {
      out.push({
        module: module || guessModule(stem), type: type || guessType(module || guessModule(stem)),
        subtype: "", difficulty: 2, stem, options: opts, answer: answer || "A",
        analysis: analysisLines.join("\n") || "（待补充解析）", tags,
        passage: lastPassage, groupId: "", figure: "", source: "AI 整理"
      });
    }
  });
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const row = (line) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if ((c === "," || c === "\t") && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur); return out;
  };
  const head = row(lines[0]).map((h) => h.trim().toLowerCase());
  const map = {
    "题干": "stem", "题目": "stem", "stem": "stem", "question": "stem",
    "模块": "module", "module": "module",
    "题型": "type", "type": "type",
    "小题型": "subtype", "subtype": "subtype",
    "选项a": "A", "a": "A", "选项b": "B", "b": "B", "选项c": "C", "c": "C", "选项d": "D", "d": "D",
    "答案": "answer", "answer": "answer",
    "解析": "analysis", "analysis": "analysis",
    "标签": "tags", "tags": "tags",
    "材料": "passage", "passage": "passage"
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = row(lines[i]);
    const o = {};
    head.forEach((h, j) => { o[map[h] || h] = cells[j]; });
    if (!o.stem) continue;
    const opts = [o.A, o.B, o.C, o.D].filter(Boolean).map((s, k) => (/^[A-D][．.、]/.test(s) ? s : String.fromCharCode(65 + k) + "．" + s));
    out.push({
      module: o.module || guessModule(o.stem), type: o.type || guessType(o.module || guessModule(o.stem)),
      subtype: o.subtype || "", difficulty: 2, stem: o.stem, options: opts,
      answer: (o.answer || "A").toUpperCase().replace(/[^A-D]/g, ""),
      analysis: o.analysis || "（待补充解析）", tags: splitArr(o.tags),
      passage: o.passage || "", groupId: "", figure: "", source: "AI 整理"
    });
  }
  return out;
}

function splitArr(v) { return v ? String(v).split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean) : []; }

function guessModule(stem) {
  if (/增长率|比重|同比|环比|亿元|万人|百分点/.test(stem)) return "资料分析";
  if (/填入|最恰当|主旨|意在|概括|排序|衔接/.test(stem)) return "言语理解";
  if (/图形|问号处|定义|属于|类比|削弱|加强|推出/.test(stem)) return "判断推理";
  if (/\d/.test(stem) && /多少|求|速度|效率|概率|成本|面积/.test(stem)) return "数量关系";
  return "常识判断";
}
function guessType(mod) {
  return ({ "言语理解": "逻辑填空", "判断推理": "定义判断", "资料分析": "综合型", "数量关系": "数学运算", "常识判断": "政治常识" })[mod] || "综合";
}

/* ---------- 卡片解析：一行一条「词：释义」或「词 —— 释义」 ---------- */
function parseCards(text, category) {
  const out = [];
  text.split(/\n/).forEach((ln) => {
    const t = ln.trim();
    if (!t) return;
    const m = t.match(/^(.{2,12})\s*[:：｜|—\-]{1,2}\s*(.+)$/) || t.match(/^(.{2,12})[\s]+(.{6,})$/);
    if (!m) return;
    const title = m[1].trim(), rest = m[2].trim();
    if (!title || rest.length < 4) return;
    out.push({
      category, title,
      summary: rest.length > 60 ? rest.slice(0, 60) + "…" : rest,
      detail: rest, example: "", confuse: [], tags: ["AI 整理"]
    });
  });
  return out;
}

function guessCardCategory(name, text) {
  if (/成语/.test(name + text.slice(0, 50))) return "成语";
  if (/实词|词语辨析|近义词/.test(name + text.slice(0, 50))) return "实词";
  if (/时政|时事|新闻|会议/.test(name + text.slice(0, 50))) return "时事政治";
  if (/政治|马原|党史|理论/.test(name + text.slice(0, 50))) return "政治常识";
  return null;
}

/* ---------- 主流程 ---------- */
function main() {
  if (!fs.existsSync(INBOX)) { console.log("inbox 目录不存在，已创建"); fs.mkdirSync(INBOX, { recursive: true }); return; }
  const files = fs.readdirSync(INBOX).filter((f) => /\.(json|csv|txt|md)$/i.test(f));
  if (!files.length) { console.log("inbox 里没有待整理的文件。把题目文件放进去再运行本脚本。"); return; }

  const bank = loadJsArray(BANK_FILE).slice();
  const cards = loadCards(CARD_FILE).slice();
  const existStem = {}; bank.forEach((q) => (existStem[q.stem.trim().slice(0, 40)] = 1));
  const existTitle = {}; cards.forEach((c) => (existTitle[c.category + "|" + c.title] = 1));

  let addedQ = 0, addedC = 0;
  files.forEach((f) => {
    const fp = path.join(INBOX, f);
    const text = fs.readFileSync(fp, "utf8");
    let qs = [], cs = [];
    if (/\.json$/i.test(f) || /^\s*[\[{]/.test(text)) {
      try {
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : data.questions || [data];
        qs = arr.filter((q) => q.stem || q.题干).map((q) => ({
          module: q.module || q.模块 || guessModule(q.stem || q.题干 || ""),
          type: q.type || q.题型 || guessType(q.module || q.模块),
          subtype: q.subtype || "", difficulty: q.difficulty || 2,
          stem: q.stem || q.题干, options: q.options || [q.A, q.B, q.C, q.D].filter(Boolean),
          answer: (q.answer || q.答案 || "A").toUpperCase().replace(/[^A-D]/g, ""),
          analysis: q.analysis || q.解析 || "（待补充解析）",
          tags: splitArr(q.tags || q.标签), passage: q.passage || "", groupId: "", figure: "", source: "AI 整理"
        }));
        if (!qs.length && Array.isArray(data)) {
          // 可能是卡片数组
          cs = data.map((c) => ({ category: c.category || "成语", title: c.title, summary: c.summary, detail: c.detail, example: c.example || "", confuse: c.confuse || [], tags: c.tags || [] }));
        }
      } catch (e) { console.warn("JSON 解析失败", f, e.message); }
    } else if (/\.csv$/i.test(f)) {
      qs = parseCSV(text);
    } else {
      qs = parseBlocks(text);
      const cat = guessCardCategory(f, text);
      if (cat && qs.length === 0) cs = parseCards(text, cat);
    }

    qs.forEach((q) => {
      const key = (q.stem || "").trim().slice(0, 40);
      if (!key || existStem[key]) return;
      existStem[key] = 1;
      q.id = "ai-" + Date.now().toString(36) + "-" + (addedQ + 1);
      bank.push(q); addedQ++;
    });
    cs.forEach((c) => {
      if (!c.title) return;
      const k = c.category + "|" + c.title;
      if (existTitle[k]) return;
      existTitle[k] = 1;
      c.id = "aicard-" + Date.now().toString(36) + "-" + (addedC + 1);
      cards.push(c); addedC++;
    });
    console.log(`  ${f}: 题目 +${qs.length}，卡片 +${cs.length}`);
  });

  if (addedQ) writeBank(bank);
  if (addedC) writeCards(cards);
  console.log(`\n整理完成：新增题目 ${addedQ} 道，新增卡片 ${addedC} 张`);
  if (addedQ || addedC) {
    // 归档已处理文件
    const done = path.join(INBOX, "已处理");
    fs.mkdirSync(done, { recursive: true });
    files.forEach((f) => fs.renameSync(path.join(INBOX, f), path.join(done, f)));
    console.log("原文件已移动到 inbox/已处理");
  }
}

function writeBank(list) {
  const head = `/* ============================================================
 * 自定义题库（AI 整理区 / 用户导入固化区）
 * 由 scripts/ingest.js 自动维护，共 ${list.length} 题。请勿手动删除历史条目。
 * ========================================================== */
window.BANK_DATA = window.BANK_DATA || [];
window.BANK_DATA.push(
`;
  const body = list.map((q) => "  " + JSON.stringify(q)).join(",\n");
  fs.writeFileSync(BANK_FILE, head + body + "\n);\n", "utf8");
}
function writeCards(list) {
  const head = `/* ============================================================
 * 自定义积累卡片（AI 整理区），共 ${list.length} 张
 * ========================================================== */
window.CARD_DATA = window.CARD_DATA || [];
window.CARD_DATA.push(
`;
  const body = list.map((c) => "  " + JSON.stringify(c)).join(",\n");
  fs.writeFileSync(CARD_FILE, head + body + "\n);\n", "utf8");
}

main();
