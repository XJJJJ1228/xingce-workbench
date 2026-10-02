/* ============================================================
 * bank.js —— 题库聚合 / 索引 / 查询
 * 内置题库（data/bank-*.js）+ 用户导入题（localStorage）
 * ========================================================== */
(function () {
  "use strict";

  var MODULES = ["言语理解", "判断推理", "资料分析", "数量关系", "常识判断"];

  // 模块 → 小题型
  var TYPES = {
    "言语理解": ["逻辑填空", "片段阅读", "语句表达"],
    "判断推理": ["图形推理", "定义判断", "类比推理", "逻辑判断"],
    "资料分析": ["文字型", "表格型", "图形型", "综合型"],
    "数量关系": ["数学运算"],
    "常识判断": ["政治常识", "法律常识", "经济常识", "科技常识", "人文历史", "地理国情", "管理公文", "生活常识"]
  };

  var MODULE_META = {
    "言语理解": { icon: "语", color: "#4f46e5", desc: "逻辑填空 · 片段阅读 · 语句表达" },
    "判断推理": { icon: "判", color: "#0891b2", desc: "图推 · 定义 · 类比 · 逻辑" },
    "资料分析": { icon: "资", color: "#059669", desc: "文字 · 表格 · 图形 · 综合" },
    "数量关系": { icon: "数", color: "#d97706", desc: "数学运算 14 类高频题型" },
    "常识判断": { icon: "常", color: "#db2777", desc: "政治 · 法律 · 科技 · 人文" }
  };

  var all = [];      // 全部题目（内置 + 自定义）
  var builtin = [];  // 内置题库
  var byId = {};

  function normalize(q, idx) {
    if (!q.id) q.id = "q-" + idx;
    q.module = q.module || "常识判断";
    q.type = q.type || "综合";
    q.subtype = q.subtype || "";
    q.difficulty = q.difficulty || 2;
    q.tags = q.tags || [];
    q.options = q.options || [];
    q.stem = q.stem || "";
    q.analysis = q.analysis || "（暂无解析）";
    q.passage = q.passage || "";
    q.figure = q.figure || "";
    q.groupId = q.groupId || "";
    q.column = q.column || "";   // 来源栏目：如 "2025郭熙100题" "2017联考A"，空=综合题库
    q.answer = (q.answer || "").toString().trim().toUpperCase().replace(/[^A-D]/g, "");
    return q;
  }

  function load() {
    all = [];
    byId = {};
    builtin = (window.BANK_DATA || []).slice();
    builtin.forEach(normalize);
    var custom = window.Store.getCustomQuestions();
    custom.forEach(normalize);
    all = builtin.concat(custom);
    all.forEach(function (q, i) {
      if (byId[q.id]) q.id = q.id + "-" + i; // 兜底去重
      byId[q.id] = q;
    });
    return all;
  }

  function reload() { return load(); }

  function get(id) { return byId[id] || null; }

  function count() { return all.length; }

  function statsByModule() {
    var m = {};
    MODULES.forEach(function (x) { m[x] = 0; });
    all.forEach(function (q) { m[q.module] = (m[q.module] || 0) + 1; });
    return m;
  }

  function statsByType(module) {
    var t = {};
    all.forEach(function (q) {
      if (module && q.module !== module) return;
      t[q.type] = (t[q.type] || 0) + 1;
    });
    return t;
  }

  function subtypesOf(module, type) {
    var s = {};
    all.forEach(function (q) {
      if (module && q.module !== module) return;
      if (type && q.type !== type) return;
      if (q.subtype) s[q.subtype] = (s[q.subtype] || 0) + 1;
    });
    return s;
  }

  // 来源栏目（如【2025郭熙100题】【2017联考A】），按模块/题型过滤
  function columnsOf(module) {
    var s = {};
    all.forEach(function (q) {
      if (module && q.module !== module) return;
      if (!q.column) return;
      s[q.column] = (s[q.column] || 0) + 1;
    });
    return s;
  }

  /**
   * 查询题目
   * @param {Object} opt { module, type, subtype, keyword, done(未做/已做/全部), wrongOnly, favOnly, difficulty, limit, random, excludeIds }
   */
  function query(opt) {
    opt = opt || {};
    var progress = window.Store.getProgress();
    var favs = window.Store.getFavs();
    var wrong = window.Store.getWrong();
    var list = all.filter(function (q) {
      if (opt.module && opt.module !== "全部" && q.module !== opt.module) return false;
      if (opt.type && opt.type !== "全部" && q.type !== opt.type) return false;
      if (opt.subtype && opt.subtype !== "全部" && q.subtype !== opt.subtype) return false;
      if (opt.column && opt.column !== "全部" && q.column !== opt.column) return false;
      if (opt.difficulty && q.difficulty !== Number(opt.difficulty)) return false;
      if (opt.excludeIds && opt.excludeIds.indexOf(q.id) >= 0) return false;
      if (opt.onlyWrong && !wrong[q.id]) return false;
      if (opt.onlyFav && favs.indexOf(q.id) < 0) return false;
      if (opt.done === "undone" && progress[q.id]) return false;
      if (opt.done === "done" && !progress[q.id]) return false;
      if (opt.done === "wrong" && !(progress[q.id] && progress[q.id].wrong > 0)) return false;
      if (opt.keyword) {
        var kw = opt.keyword.toLowerCase();
        var text = (q.stem + " " + q.analysis + " " + (q.tags || []).join(" ") + " " + q.type + " " + (q.subtype || "")).toLowerCase();
        if (text.indexOf(kw) < 0) return false;
      }
      return true;
    });
    if (opt.random) shuffle(list);
    if (opt.limit) list = list.slice(0, opt.limit);
    return list;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /**
   * 随机组卷：按模块比例抽题
   */
  function makePaper(total, ratio) {
    ratio = ratio || { "言语理解": 0.3, "判断推理": 0.3, "资料分析": 0.15, "数量关系": 0.1, "常识判断": 0.15 };
    var out = [];
    var used = {};
    MODULES.forEach(function (m) {
      var n = Math.round(total * (ratio[m] || 0));
      var pool = query({ module: m, random: true, limit: n, excludeIds: out.map(function (q) { return q.id; }) });
      pool.forEach(function (q) { if (!used[q.id]) { used[q.id] = 1; out.push(q); } });
    });
    // 不足则补齐
    if (out.length < total) {
      var rest = query({ random: true, limit: total - out.length, excludeIds: out.map(function (q) { return q.id; }) });
      rest.forEach(function (q) { if (!used[q.id]) { used[q.id] = 1; out.push(q); } });
    }
    // 资料分析按材料分组放在一起
    var withGroup = out.filter(function (q) { return q.groupId; });
    if (withGroup.length) {
      var groups = {};
      withGroup.forEach(function (q) { (groups[q.groupId] = groups[q.groupId] || []).push(q); });
      var noGroup = out.filter(function (q) { return !q.groupId; });
      var final = [];
      Object.keys(groups).forEach(function (g) { final = final.concat(groups[g]); });
      out = final.concat(noGroup);
    }
    return out.slice(0, total);
  }

  window.Bank = {
    MODULES: MODULES,
    TYPES: TYPES,
    MODULE_META: MODULE_META,
    load: load,
    reload: reload,
    get: get,
    all: function () { return all; },
    builtinCount: function () { return builtin.length; },
    customCount: function () { return window.Store.getCustomQuestions().length; },
    count: count,
    statsByModule: statsByModule,
    statsByType: statsByType,
    subtypesOf: subtypesOf,
    columnsOf: columnsOf,
    query: query,
    makePaper: makePaper,
    shuffle: shuffle
  };
})();
