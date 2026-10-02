/* ============================================================
 * 刷题配置页
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var state = {
    mode: "sequence",     // sequence | paper | special | wrong | fav
    modules: [],          // 空 = 全部
    types: [],
    subtype: "全部",
    column: "全部",       // 来源栏目筛选（如 2025郭熙100题 / 2017联考A），仅言语理解等含栏目的模块可用
    scope: "all",         // all | undone | wrong | done
    count: Store.getSettings().questionCount || 20,
    paperPreset: "standard"
  };

  var PAPER_PRESETS = {
    standard: { name: "国考标准", ratio: { "言语理解": .3, "判断推理": .3, "资料分析": .15, "数量关系": .1, "常识判断": .15 } },
    even: { name: "五模块均衡", ratio: { "言语理解": .2, "判断推理": .2, "资料分析": .2, "数量关系": .2, "常识判断": .2 } },
    weak: { name: "弱项强化", ratio: null }
  };

  var View = {};

  View.render = function (params) {
    if (params && params.module) state.modules = [params.module];
    if (params && params.mode) state.mode = params.mode;
    var el = $("#view-practice");
    el.innerHTML = heroHtml() + configHtml() + modulesHtml() + recentHtml();
    bind();
    refreshTypes();
  };

  function heroHtml() {
    var modes = [
      ["sequence", "顺序刷题", "按题库顺序连续练习"],
      ["paper", "随机组卷", "按模块比例生成模拟卷"],
      ["special", "专项刷题", "锁定某个小题型突破"],
      ["wrong", "错题重刷", "只刷错题本中的题"],
      ["fav", "收藏重刷", "只刷收藏题集"]
    ];
    return '<div class="practice-hero">' +
      "<h2>刷题练习</h2><p>题库共 " + Bank.count() + " 题（内置 " + Bank.builtinCount() + " + 导入 " + Bank.customCount() + "），全部带详细解析</p>" +
      '<div class="hero-row">' +
      modes.map(function (m) {
        return '<span class="chip' + (state.mode === m[0] ? " active" : "") + '" data-mode="' + m[0] + '" title="' + m[2] + '">' + m[1] + "</span>";
      }).join("") +
      '<div class="spacer"></div>' +
      '<span style="font-size:12.5px;opacity:.9">题量</span>' +
      '<input type="number" class="white-input" id="heroCount" min="1" max="200" value="' + state.count + '">' +
      '<button class="btn primary" id="btnStart">开始刷题</button>' +
      "</div></div>";
  }

  function configHtml() {
    var need = state.mode === "sequence" || state.mode === "special";
    if (!need) {
      if (state.mode === "paper") {
        return '<div class="card card-pad sec"><div class="sec-title">组卷设置</div>' +
          '<div class="row"><span class="hint">卷型：</span>' +
          Object.keys(PAPER_PRESETS).map(function (k) {
            return '<span class="chip' + (state.paperPreset === k ? " active" : "") + '" data-preset="' + k + '">' + PAPER_PRESETS[k].name + "</span>";
          }).join("") +
          '<span class="spacer"></span><span class="hint" id="paperHint"></span></div>' +
          '<div class="hint" style="margin-top:8px">随机组卷会按模块比例抽取题目，资料分析题会自动把同一篇材料的题目放在一起。</div></div>';
      }
      var label = state.mode === "wrong" ? "错题重刷" : "收藏重刷";
      var total = state.mode === "wrong" ? Object.keys(Store.getWrong()).length : Store.getFavs().length;
      return '<div class="card card-pad sec"><div class="sec-title">' + label + " <span class=\"sub\">当前共 " + total + " 题</span></div>" +
        '<div class="row"><span class="chip active">随机打乱</span>' +
        (state.mode === "wrong" ? '<span class="chip" id="chipDueOnly">只刷到期复习的</span>' : "") +
        '<span class="spacer"></span><span class="hint">题量可在上方调整</span></div></div>';
    }

    var html = '<div class="card card-pad sec"><div class="sec-title">选题范围</div>';

    // 模块
    html += '<div class="filter-row"><span class="fl">模块</span><span class="chip' + (state.modules.length === 0 ? " active" : "") + '" data-mod="全部">全部</span>' +
      Bank.MODULES.map(function (m) {
        return '<span class="chip' + (state.modules.indexOf(m) >= 0 ? " active" : "") + '" data-mod="' + m + '">' + m + "（" + (Bank.statsByModule()[m] || 0) + "）</span>";
      }).join("") + "</div>";

    // 题型
    html += '<div class="filter-row"><span class="fl">题型</span><span id="typeBox"></span></div>';

    // 来源栏目（动态：仅当所选模块下存在栏目时显示）
    var cols = Bank.columnsOf(state.modules.length === 1 ? state.modules[0] : (state.modules.length === 0 ? undefined : undefined));
    // 多模块时不显示栏目（栏目是单模块维度），单模块/全模块显示该模块下栏目
    if (state.modules.length > 1) cols = {};
    var colKeys = Object.keys(cols);
    if (colKeys.length) {
      colKeys.sort(function (a, b) { return cols[b] - cols[a]; });
      if (state.column !== "全部" && colKeys.indexOf(state.column) < 0) state.column = "全部";
      html += '<div class="filter-row"><span class="fl">栏目</span>' +
        '<span class="chip' + (state.column === "全部" ? " active" : "") + '" data-col="全部">全部</span>' +
        colKeys.map(function (k) {
          return '<span class="chip' + (state.column === k ? " active" : "") + '" data-col="' + esc(k) + '">【' + esc(k) + '】（' + cols[k] + "）</span>";
        }).join("") + "</div>";
    }

    // 小题型
    html += '<div class="filter-row"><span class="fl">小题型</span><span id="subBox"></span></div>';

    // 做题状态
    var scopes = [["all", "全部"], ["undone", "只做未做过的"], ["wrong", "只做曾做错的"], ["done", "只做已做过的"]];
    html += '<div class="filter-row"><span class="fl">状态</span>' +
      scopes.map(function (s) {
        return '<span class="chip' + (state.scope === s[0] ? " active" : "") + '" data-scope="' + s[0] + '">' + s[1] + "</span>";
      }).join("") + "</div>";

    html += '<div class="row" style="margin-top:12px"><span class="hint" id="matchInfo"></span></div>';
    html += "</div>";
    return html;
  }

  function modulesHtml() {
    if (state.mode === "wrong" || state.mode === "fav") return "";
    var mods = StatLib.byModule();
    return '<div class="sec-title">模块速览 <span class="sub">点击进入该模块专项</span></div>' +
      '<div class="grid g5 sec">' + mods.map(function (m) {
        var meta = Bank.MODULE_META[m.module];
        return '<div class="mod-card" data-modcard="' + m.module + '">' +
          '<div class="mc-top"><div class="mc-ic" style="background:' + meta.color + '">' + meta.icon + "</div>" +
          '<div><div class="mc-name">' + m.module + '</div><div class="mc-desc">' + meta.desc + "</div></div></div>" +
          '<div class="mc-stat"><div><b>' + m.total + "</b> 题</div><div><b>" + (m.done ? m.accuracy + "%" : "—") + "</b> 正确率</div></div>" +
          '<div class="mc-mini"><i style="width:' + m.coverage + "%;background:" + meta.color + '"></i></div>' +
          "</div>";
      }).join("") + "</div>";
  }

  function recentHtml() {
    var s = Store.getSessions().slice(-8).reverse();
    if (!s.length) return "";
    return '<div class="sec-title">最近练习</div><div class="card sec"><table class="tbl"><thead><tr>' +
      "<th>时间</th><th>模式</th><th>题量</th><th>正确率</th><th>用时</th><th></th></tr></thead><tbody>" +
      s.map(function (x, i) {
        var id = Store.getSessions().length - 1 - i;
        return "<tr><td>" + UI.fmtDateTime(x.endAt || x.startAt) + "</td><td>" + esc(x.name || "练习") + "</td>" +
          "<td>" + x.total + "</td><td style='color:" + (x.accuracy >= 70 ? "#059669" : x.accuracy >= 50 ? "#d97706" : "#e11d48") + ";font-weight:600'>" + x.accuracy + "%</td>" +
          "<td>" + UI.fmtShort(x.duration) + "</td><td><button class='btn sm' data-redo='" + id + "'>重做这套</button></td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function refreshTypes() {
    var box = $("#typeBox");
    if (!box) return;
    var types = [];
    if (state.modules.length === 0) {
      types = Bank.MODULES.reduce(function (a, m) { return a.concat(Bank.TYPES[m]); }, []);
    } else {
      state.modules.forEach(function (m) { types = types.concat(Bank.TYPES[m] || []); });
    }
    var counts = Bank.statsByType();
    var html = '<span class="chip' + (state.types.length === 0 ? " active" : "") + '" data-type="全部">全部</span>';
    // 数量关系/常识的 type 与模块同名，去重
    types = types.filter(function (t, i) { return types.indexOf(t) === i; });
    html += types.map(function (t) {
      return '<span class="chip' + (state.types.indexOf(t) >= 0 ? " active" : "") + '" data-type="' + t + '">' + t + "（" + (counts[t] || 0) + "）</span>";
    }).join("");
    box.innerHTML = html;
    $$("#typeBox .chip").forEach(function (c) {
      c.onclick = function () {
        var t = c.dataset.type;
        if (t === "全部") state.types = [];
        else {
          var i = state.types.indexOf(t);
          if (i >= 0) state.types.splice(i, 1); else state.types.push(t);
        }
        refreshTypes(); refreshSub(); refreshMatch();
      };
    });
    refreshSub();
    refreshMatch();
  }

  function refreshSub() {
    var box = $("#subBox");
    if (!box) return;
    var subs = {};
    if (state.modules.length === 0 && state.types.length === 0) {
      subs = {};
      Bank.all().forEach(function (q) { if (q.subtype) subs[q.subtype] = (subs[q.subtype] || 0) + 1; });
    } else if (state.types.length) {
      state.types.forEach(function (t) {
        Bank.all().forEach(function (q) { if (q.type === t && q.subtype) subs[q.subtype] = (subs[q.subtype] || 0) + 1; });
      });
    } else {
      state.modules.forEach(function (m) {
        Bank.all().forEach(function (q) { if (q.module === m && q.subtype) subs[q.subtype] = (subs[q.subtype] || 0) + 1; });
      });
    }
    var keys = Object.keys(subs);
    if (!keys.length) { box.innerHTML = '<span class="hint">（该范围下没有更细分类）</span>'; return; }
    keys.sort(function (a, b) { return subs[b] - subs[a]; });
    if (state.subtype !== "全部" && keys.indexOf(state.subtype) < 0) state.subtype = "全部";
    box.innerHTML = '<span class="chip' + (state.subtype === "全部" ? " active" : "") + '" data-sub="全部">全部</span>' +
      keys.map(function (k) {
        return '<span class="chip' + (state.subtype === k ? " active" : "") + '" data-sub="' + esc(k) + '">' + esc(k) + "（" + subs[k] + "）</span>";
      }).join("");
    $$("#subBox .chip").forEach(function (c) {
      c.onclick = function () { state.subtype = c.dataset.sub; refreshSub(); refreshMatch(); };
    });
  }

  function refreshMatch() {
    var info = $("#matchInfo");
    if (!info) return;
    var n = buildQuery(true).length;
    info.innerHTML = "匹配到 <b style='color:var(--primary)'>" + n + "</b> 题" + (n === 0 ? "，请放宽筛选条件" : "");
  }

  function mix(base, extra) {
    var o = {};
    for (var k in base) if (base.hasOwnProperty(k)) o[k] = base[k];
    for (var j in extra) if (extra.hasOwnProperty(j)) o[j] = extra[j];
    return o;
  }

  function buildQuery(countOnly) {
    if (state.mode === "wrong") {
      var w = Store.getWrong();
      var ids = Object.keys(w);
      var dueOnly = state.dueOnly;
      if (dueOnly) {
        var due = {}; StatLib.dueWrongIds().forEach(function (i) { due[i] = 1; });
        ids = ids.filter(function (i) { return due[i]; });
      }
      var list = ids.map(function (i) { return Bank.get(i); }).filter(Boolean);
      Bank.shuffle(list);
      return countOnly ? list : list.slice(0, state.count);
    }
    if (state.mode === "fav") {
      var f = Store.getFavs().map(function (i) { return Bank.get(i); }).filter(Boolean);
      Bank.shuffle(f);
      return countOnly ? f : f.slice(0, state.count);
    }
    var opt = {
      done: state.scope === "all" ? undefined : state.scope,
      random: state.mode === "paper" || state.mode === "special",
      subtype: state.subtype === "全部" ? undefined : state.subtype,
      column: state.column === "全部" ? undefined : state.column
    };
    var out = [];
    if (state.modules.length === 0) {
      if (state.types.length === 0) {
        out = Bank.query(opt);
      } else {
        state.types.forEach(function (t) {
          out = out.concat(Bank.query(mix(opt, { type: t })));
        });
      }
    } else {
      state.modules.forEach(function (m) {
        var base = mix(opt, { module: m });
        var valid = (Bank.TYPES[m] || []).filter(function (t) { return state.types.indexOf(t) >= 0; });
        if (valid.length) {
          valid.forEach(function (t) { out = out.concat(Bank.query(mix(base, { type: t }))); });
        } else if (state.types.length === 0) {
          out = out.concat(Bank.query(base));
        }
      });
    }
    // 去重
    var seen = {}, uniq = [];
    out.forEach(function (q) { if (!seen[q.id]) { seen[q.id] = 1; uniq.push(q); } });
    if (opt.random) Bank.shuffle(uniq);
    return countOnly ? uniq : uniq.slice(0, state.count);
  }

  function start() {
    var list = [];
    if (state.mode === "paper") {
      var preset = PAPER_PRESETS[state.paperPreset];
      var ratio = preset.ratio;
      if (!ratio) {
        // 弱项强化：按正确率反比
        var mods = StatLib.byModule();
        var weights = mods.map(function (m) { return 1 + (100 - (m.done ? m.accuracy : 60)) / 50; });
        var sum = weights.reduce(function (a, b) { return a + b; }, 0);
        ratio = {};
        mods.forEach(function (m, i) { ratio[m.module] = weights[i] / sum; });
      }
      list = Bank.makePaper(state.count, ratio);
    } else {
      list = buildQuery(false);
    }
    if (!list.length) { UI.toast("没有符合条件的题目，请调整筛选"); return; }
    var names = { sequence: "顺序刷题", paper: "随机组卷", special: "专项刷题", wrong: "错题重刷", fav: "收藏重刷" };
    App.startSession(list, names[state.mode] + " · " + list.length + "题");
  }

  function bind() {
    $$("#view-practice .chip[data-mode]").forEach(function (c) {
      c.onclick = function () { state.mode = c.dataset.mode; View.render(); };
    });
    $$("#view-practice .chip[data-mod]").forEach(function (c) {
      c.onclick = function () {
        var m = c.dataset.mod;
        if (m === "全部") state.modules = [];
        else { state.types = []; var i = state.modules.indexOf(m); if (i >= 0) state.modules.splice(i, 1); else state.modules.push(m); }
        state.subtype = "全部";
        state.column = "全部";
        View.render();
      };
    });
    $$("#view-practice .chip[data-col]").forEach(function (c) {
      c.onclick = function () { state.column = c.dataset.col; View.render(); };
    });
    $$("#view-practice .chip[data-scope]").forEach(function (c) {
      c.onclick = function () { state.scope = c.dataset.scope; View.render(); };
    });
    $$("#view-practice .chip[data-preset]").forEach(function (c) {
      c.onclick = function () { state.paperPreset = c.dataset.preset; View.render(); };
    });
    $$("#view-practice .mod-card[data-modcard]").forEach(function (c) {
      c.onclick = function () { state.modules = [c.dataset.modcard]; state.types = []; state.subtype = "全部"; state.mode = "special"; View.render(); window.scrollTo(0, 0); };
    });
    var chipDue = $("#chipDueOnly");
    if (chipDue) {
      if (state.dueOnly) chipDue.classList.add("active");
      chipDue.onclick = function () { state.dueOnly = !state.dueOnly; chipDue.classList.toggle("active", state.dueOnly); };
    }
    var cnt = $("#heroCount");
    cnt.oninput = function () {
      var v = parseInt(cnt.value, 10);
      if (!isNaN(v) && v > 0) { state.count = v; Store.setSettings({ questionCount: v }); refreshMatch(); }
    };
    $("#btnStart").onclick = start;
    $$("#view-practice button[data-redo]").forEach(function (b) {
      b.onclick = function () {
        var s = Store.getSessions()[+b.dataset.redo];
        if (!s) return;
        var list = (s.qids || []).map(function (id) { return Bank.get(id); }).filter(Boolean);
        if (!list.length) { UI.toast("题目已不存在"); return; }
        App.startSession(list, "重做：" + (s.name || "练习"));
      };
    });
    var hint = $("#paperHint");
    if (hint) {
      var p = PAPER_PRESETS[state.paperPreset];
      if (p.ratio) {
        hint.textContent = Object.keys(p.ratio).map(function (m) {
          return m + " " + Math.round(state.count * p.ratio[m]) + "题";
        }).join(" · ");
      } else hint.textContent = "按你的正确率反比分配，弱项多练";
    }
  }

  View.state = state;
  window.ViewPractice = View;
})();
