/* 冒烟测试：用 jsdom 加载应用，模拟一次完整刷题流程，捕获运行时错误
 * 前置：
 *   1) npm i jsdom
 *   2) 在另一个终端运行 node scripts/server.js
 * 然后：node scripts/smoke-test.js
 */
let jsdomMod;
try {
  jsdomMod = require("jsdom");
} catch (e) {
  console.error("❌ 未找到 jsdom。请先执行：npm i jsdom");
  process.exit(2);
}
const { JSDOM, VirtualConsole } = jsdomMod;

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

function fakeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === "createLinearGradient") return () => grad;
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "canvas") return { width: 600, height: 200 };
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return ctx;
}

(async () => {
  const dom = await JSDOM.fromURL("http://localhost:8756/index.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = () => fakeCtx();
      win.scrollTo = () => {};
      win.HTMLElement.prototype.scrollIntoView = () => {};
      win.alert = (m) => errors.push("alert: " + m);
      win.onerror = (msg, src, l, c, err) => errors.push("onerror: " + (err && err.stack || msg));
    }
  });

  const win = dom.window;
  await new Promise((r) => win.addEventListener("load", r));
  await new Promise((r) => setTimeout(r, 800));

  const $ = (s) => win.document.querySelector(s);
  const $$ = (s) => Array.from(win.document.querySelectorAll(s));
  const log = (...a) => console.log(...a);

  log("== 1. 初始化 ==");
  log("题库题数:", win.Bank.count(), "| 卡片数:", (win.CARD_DATA || []).length);
  log("首页渲染长度:", $("#view-home").innerHTML.length);
  if ($("#view-home").innerHTML.length < 500) errors.push("首页渲染异常");

  log("== 2. 各页面渲染 ==");
  ["practice", "wrong", "fav", "cards", "stats", "import", "settings", "home"].forEach((v) => {
    try {
      win.App.go(v);
      const len = $("#view-" + v).innerHTML.length;
      log(`  ${v}: ${len} 字符`);
      if (len < 100) errors.push(`${v} 页面渲染内容过少`);
    } catch (e) { errors.push(`${v} 渲染异常: ` + e.stack); }
  });

  log("== 3. 模拟刷题（10 题） ==");
  win.App.go("practice");
  const cnt = $("#heroCount");
  if (cnt) { cnt.value = "10"; cnt.dispatchEvent(new win.Event("input")); }
  $("#btnStart").click();
  await new Promise((r) => setTimeout(r, 200));
  log("  会话视图内容长度:", $("#view-session").innerHTML.length);

  for (let i = 0; i < 10; i++) {
    const opts = $$("#optBox .opt");
    if (!opts.length) { errors.push("第 " + (i + 1) + " 题没有选项"); break; }
    opts[i % 2].click();
    const cf = $("#btnConfirm");
    if (cf) cf.click();
    await new Promise((r) => setTimeout(r, 30));
    const nx = $("#btnNextQ") || $("#btnFinish");
    if (!nx) { errors.push("第 " + (i + 1) + " 题没有下一题/交卷按钮"); break; }
    nx.click();
    await new Promise((r) => setTimeout(r, 30));
  }

  const progress = win.Store.getProgress();
  const wrong = win.Store.getWrong();
  log("  已做题数:", Object.keys(progress).length, "| 错题本:", Object.keys(wrong).length);
  if (Object.keys(progress).length < 10) errors.push("答题进度未正确记录");
  if (Object.keys(wrong).length === 0) errors.push("错题未自动入库");

  log("== 4. 报告页 ==");
  const report = $("#view-session").textContent.includes("本次答对");
  log("  报告渲染:", report ? "OK" : "缺失");
  if (!report) errors.push("报告页未渲染");

  log("== 5. 错题本交互 ==");
  win.App.go("wrong");
  const items = $$("#view-wrong .item");
  log("  错题条目:", items.length);
  if (!items.length) errors.push("错题列表为空");
  const tagBtn = $('[data-tag]');
  if (tagBtn) tagBtn.click();
  await new Promise((r) => setTimeout(r, 100));
  const dtag = $$("#modalBox [data-dtag]")[0];
  if (dtag) { dtag.click(); log("  标签切换: OK"); } else errors.push("错题详情标签未渲染");
  if ($("#dtNote")) { $("#dtNote").value = "测试笔记"; $("#dtSave").click(); log("  笔记保存: OK"); }
  await new Promise((r) => setTimeout(r, 100));
  const redoBtn = $('[data-redo]');
  if (redoBtn) redoBtn.click();
  await new Promise((r) => setTimeout(r, 100));
  const dopt = $$("#dtOpt .opt")[0];
  if (dopt) {
    dopt.click();
    await new Promise((r) => setTimeout(r, 50));
    const sub = $("#dtSubmit");
    if (sub) { sub.click(); log("  二次作答: OK"); } else errors.push("二次作答无提交按钮");
  } else errors.push("二次作答模式无选项");
  win.UI.closeModal();

  log("== 6. 收藏 ==");
  win.App.go("fav");
  log("  收藏页渲染:", $("#view-fav").innerHTML.length > 200 ? "OK" : "空");

  log("== 7. 卡片专区 ==");
  win.App.go("cards");
  const cards = $$("#view-cards .flip-card");
  log("  卡片数:", cards.length);
  if (!cards.length) errors.push("卡片未渲染");
  const mbtn = $('[data-master]');
  if (mbtn) mbtn.click();
  log("  标掌握: OK");

  log("== 8. 导入解析 ==");
  const parsed = win.ViewImport.parser.parse(
    "模块：常识判断\n题型：政治常识\n我国的根本政治制度是：______\nA．人民代表大会制度\nB．多党合作制\nC．民族区域自治制度\nD．基层群众自治制度\n答案：A\n解析：【解析】人民代表大会制度是我国根本政治制度。故正确答案为A。\n\n" +
    "依次填入最恰当的一项是：______\nA．遏制\nB．遏止\nC．制止\nD．禁止\n答案：A\n解析：【解析】遏制侧重控制。故正确答案为A。",
    "test.txt");
  log("  文本解析题数:", parsed.length, parsed.length ? "（模块：" + parsed[0].module + " / 答案：" + parsed[0].answer + "）" : "");
  if (parsed.length !== 2) errors.push("文本导入解析失败，期望 2 题，实际 " + parsed.length);
  const csvParsed = win.ViewImport.parser.parse(
    "模块,题型,题干,选项A,选项B,选项C,选项D,答案,解析\n数量关系,数学运算,1+1=?,1,2,3,4,B,【解析】1+1=2。故正确答案为B。", "t.csv");
  log("  CSV 解析题数:", csvParsed.length);
  if (csvParsed.length !== 1) errors.push("CSV 解析失败");

  log("== 9. 持久化 ==");
  const keys = win.Store.keys();
  log("  存储键:", keys.join(", "));
  if (keys.indexOf("progress") < 0) errors.push("progress 未持久化");

  log("\n== 结果 ==");
  if (errors.length) {
    console.log("❌ 发现 " + errors.length + " 个问题：");
    errors.forEach((e) => console.log(" - " + e));
    process.exit(1);
  } else {
    console.log("✅ 全部通过，无运行时错误");
  }
  dom.window.close();
})();
