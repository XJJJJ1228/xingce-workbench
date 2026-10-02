/* ============================================================
 * 统计计算库 + 首页看板
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, esc = UI.esc;

  /* ---------------- 统计库 ---------------- */
  var StatLib = {
    // 复习间隔（天）：按掌握程度
    intervalOf: function (master) { return [1, 2, 4, 15][master || 0]; },

    overview: function () {
      var progress = Store.getProgress();
      var wrong = Store.getWrong();
      var records = Store.getRecords();
      var favs = Store.getFavs();
      var daily = Store.getDaily();

      var done = 0, correct = 0;
      Object.keys(progress).forEach(function (k) {
        var p = progress[k];
        done += p.done || 0; correct += p.correct || 0;
      });

      // 本周（周一为起点）
      var weekMs = 0, weekCount = 0, weekCorrect = 0;
      var d = new Date();
      var day = (d.getDay() + 6) % 7;
      var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
      Object.keys(daily).forEach(function (k) {
        var parts = k.split("-");
        var kd = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        if (kd >= monday) { weekMs += daily[k].ms || 0; weekCount += daily[k].count || 0; weekCorrect += daily[k].correct || 0; }
      });

      var due = this.dueWrongIds().length;

      var tk = Store.todayKey();
      var today = daily[tk] || { ms: 0, count: 0, correct: 0 };

      return {
        done: done, correct: correct,
        accuracy: done ? Math.round(correct / done * 1000) / 10 : 0,
        weekMs: weekMs, weekCount: weekCount,
        weekAccuracy: weekCount ? Math.round(weekCorrect / weekCount * 1000) / 10 : 0,
        wrongTotal: Object.keys(wrong).length,
        due: due,
        fav: favs.length,
        streak: this.streak(),
        today: today,
        records: records.length
      };
    },

    byModule: function () {
      var progress = Store.getProgress();
      var out = {};
      Bank.MODULES.forEach(function (m) { out[m] = { module: m, done: 0, correct: 0, total: 0 }; });
      Bank.all().forEach(function (q) { if (out[q.module]) out[q.module].total++; });
      Object.keys(progress).forEach(function (id) {
        var q = Bank.get(id); if (!q) return;
        var m = out[q.module]; if (!m) return;
        m.done += progress[id].done || 0;
        m.correct += progress[id].correct || 0;
      });
      return Bank.MODULES.map(function (m) {
        var o = out[m];
        o.accuracy = o.done ? Math.round(o.correct / o.done * 1000) / 10 : 0;
        o.coverage = o.total ? Math.round(o.done / o.total * 100) : 0;
        return o;
      });
    },

    byType: function () {
      var progress = Store.getProgress();
      var out = {};
      Object.keys(progress).forEach(function (id) {
        var q = Bank.get(id); if (!q) return;
        var k = q.module + " / " + q.type;
        out[k] = out[k] || { key: k, module: q.module, type: q.type, done: 0, correct: 0 };
        out[k].done += progress[id].done || 0;
        out[k].correct += progress[id].correct || 0;
      });
      return Object.keys(out).map(function (k) {
        var o = out[k]; o.accuracy = o.done ? Math.round(o.correct / o.done * 1000) / 10 : 0; return o;
      }).sort(function (a, b) { return a.accuracy - b.accuracy; });
    },

    daily: function (days) {
      days = days || 14;
      var daily = Store.getDaily();
      var out = [];
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var k = Store.todayKey(d);
        var v = daily[k] || { ms: 0, count: 0, correct: 0 };
        out.push({ key: k, label: (d.getMonth() + 1) + "/" + d.getDate(), count: v.count, correct: v.correct, ms: v.ms });
      }
      return out;
    },

    // 近 N 天正确率趋势
    trend: function (days) {
      return this.daily(days || 14).map(function (x) {
        return { label: x.label, value: x.count ? Math.round(x.correct / x.count * 100) : null };
      });
    },

    dueWrongIds: function () {
      var w = Store.getWrong();
      var now = Date.now();
      return Object.keys(w).filter(function (id) {
        var it = w[id];
        if (it.master >= 3) return false;
        var base = it.lastReviewAt || it.addedAt || now;
        return now >= base + StatLib.intervalOf(it.master) * 86400000;
      });
    },

    streak: function () {
      var daily = Store.getDaily();
      var n = 0;
      var d = new Date();
      // 今天没学就从昨天算起
      if (!(daily[Store.todayKey(d)] || {}).count) d.setDate(d.getDate() - 1);
      while (true) {
        var k = Store.todayKey(d);
        if ((daily[k] || {}).count) { n++; d.setDate(d.getDate() - 1); }
        else break;
        if (n > 999) break;
      }
      return n;
    },

    // 每个模块的待复习错题数
    dueByModule: function () {
      var ids = this.dueWrongIds(), out = {};
      ids.forEach(function (id) {
        var q = Bank.get(id); if (!q) return;
        out[q.module] = (out[q.module] || 0) + 1;
      });
      return out;
    },

    weakTypes: function (n) {
      return this.byType().filter(function (t) { return t.done >= 3; }).slice(0, n || 5);
    }
  };
  window.StatLib = StatLib;

  /* ---------------- 首页 ---------------- */
  var View = {};

  View.render = function () {
    var o = StatLib.overview();
    var settings = Store.getSettings();
    var mods = StatLib.byModule();
    var daily = StatLib.daily(14);
    var dueByModule = StatLib.dueByModule();
    var d = new Date();
    var weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    var hour = d.getHours();
    var greet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

    var goalPct = Math.min(100, Math.round(o.today.count / Math.max(1, settings.dailyGoal) * 100));

    var html = "";

    /* --- 顶部统计 --- */
    html += '<div class="sec">' +
      '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
      '<h2 style="margin:0;font-size:20px">' + greet + '，今天也要上岸 💪</h2>' +
      '<span class="hint">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekNames[d.getDay()] + ' · 连续打卡 ' + o.streak + ' 天</span>' +
      "</div>" +
      '<div class="stat-grid">' +
      statCard("accent-1", "累计刷题量", o.done, "题", "已做 " + o.done + " / 题库 " + Bank.count(), Math.min(100, Math.round(o.done / Math.max(1, Bank.count()) * 100)), "#4f46e5") +
      statCard("accent-2", "总体正确率", o.accuracy, "%", "答对 " + o.correct + " 题", o.accuracy, "#059669") +
      statCard("accent-3", "本周学习时长", (o.weekMs / 3600000).toFixed(1), "h", "本周 " + o.weekCount + " 题 · 正确率 " + o.weekAccuracy + "%", Math.min(100, o.weekMs / 3600000 / 10 * 100), "#d97706") +
      statCard("accent-4", "待复习错题", o.due, "题", "错题本共 " + o.wrongTotal + " 题", Math.min(100, o.due / Math.max(1, o.wrongTotal) * 100), "#e11d48") +
      "</div></div>";

    /* --- 两栏：模块正确率 + 今日任务 --- */
    html += '<div class="grid g2 sec" style="grid-template-columns:1.15fr .85fr">';

    // 模块正确率
    html += '<div class="card card-pad"><div class="sec-title">各模块正确率 <span class="sub">已做题数 / 模块题库</span></div><div class="mod-list">';
    mods.forEach(function (m) {
      var meta = Bank.MODULE_META[m.module];
      html += '<div class="mod-row">' +
        '<div class="mod-name"><span class="mod-dot" style="background:' + meta.color + '"></span>' + m.module + "</div>" +
        '<div class="mod-bar"><i style="width:' + Math.max(2, m.accuracy) + "%;background:" + meta.color + '"></i></div>' +
        '<div class="mod-num"><b style="color:' + meta.color + '">' + (m.done ? m.accuracy + "%" : "—") + "</b> · " + m.done + "/" + m.total + "</div>" +
        "</div>";
    });
    html += "</div>";
    var weak = StatLib.weakTypes(3);
    if (weak.length) {
      html += '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)">' +
        '<div class="hint" style="margin-bottom:6px">薄弱题型（已做≥3题）</div>' +
        weak.map(function (t) {
          return '<span class="chip" style="margin:0 6px 6px 0;background:' + (t.accuracy < 50 ? "#fdeaef" : "#fff5e6") + ";color:" + (t.accuracy < 50 ? "#e11d48" : "#d97706") + '">' +
            esc(t.type) + " " + t.accuracy + "%（" + t.done + "题）</span>";
        }).join("") + "</div>";
    }
    html += "</div>";

    // 今日任务
    html += '<div class="card card-pad"><div class="sec-title">今日任务 <span class="sub">目标 ' + settings.dailyGoal + ' 题 · 已完成 ' + o.today.count + " 题（" + goalPct + "%）</span></div>" +
      '<div class="stat" style="padding:12px 0;box-shadow:none;border:none;border-radius:0"><div class="bar" style="margin-top:0"><i style="width:' + goalPct + '%"></i></div></div>' +
      '<div class="task-list">' +
      task("🎯", "开始新一轮刷题", "顺序 / 随机组卷 / 专项突破，一次 " + settings.questionCount + " 题", "practice") +
      task("📕", "复习待办错题", o.due + " 题到期需要重做", "wrong") +
      task("🗂", "背诵积累卡片", "成语 · 实词 · 政治常识 · 时事", "cards") +
      (Object.keys(dueByModule).length ?
        task("⚠️", "最需补强模块", Object.keys(dueByModule).sort(function (a, b) { return dueByModule[b] - dueByModule[a]; }).slice(0, 2)
          .map(function (m) { return m + " " + dueByModule[m] + "题"; }).join(" · "), "wrong") : "") +
      "</div></div>";

    html += "</div>";

    /* --- 近 14 天 --- */
    html += '<div class="card card-pad sec">' +
      '<div class="sec-title">近 14 天刷题量 <span class="sub">共 ' + daily.reduce(function (s, x) { return s + x.count; }, 0) + " 题 · 累计 " + UI.fmtDuration(daily.reduce(function (s, x) { return s + x.ms; }, 0)) + "</span></div>" +
      '<div class="chart-box"><canvas id="homeBar"></canvas></div></div>';

    /* --- 快捷入口 --- */
    html += '<div class="sec-title">模块速览</div><div class="grid g5 sec">';
    mods.forEach(function (m) {
      var meta = Bank.MODULE_META[m.module];
      html += '<div class="mod-card" data-gotype="' + m.module + '">' +
        '<div class="mc-top"><div class="mc-ic" style="background:' + meta.color + '">' + meta.icon + "</div>" +
        '<div><div class="mc-name">' + m.module + '</div><div class="mc-desc">' + meta.desc + "</div></div></div>" +
        '<div class="mc-stat"><div><b>' + m.total + "</b> 题库</div><div><b>" + (m.done ? m.accuracy + "%" : "—") + "</b> 正确率</div></div>" +
        '<div class="mc-mini"><i style="width:' + m.coverage + "%;background:" + meta.color + '"></i></div>' +
        '<div class="hint" style="margin-top:6px">已练 ' + m.coverage + "%</div>" +
        "</div>";
    });
    html += "</div>";

    UI.$("#view-home").innerHTML = html;

    UI.barChart($("#homeBar"), daily.map(function (x) { return x.label; }), daily.map(function (x) { return x.count; }), { height: 190 });

    // 事件
    UI.$$("#view-home .task").forEach(function (t) {
      t.onclick = function () { App.go(t.dataset.go); };
    });
    UI.$$("#view-home .mod-card").forEach(function (c) {
      c.onclick = function () { App.go("practice", { module: c.dataset.gotype }); };
    });
  };

  function statCard(accent, label, value, unit, foot, pct, color) {
    return '<div class="stat ' + accent + '">' +
      '<div class="label">' + label + "</div>" +
      '<div class="value">' + value + '<span class="unit">' + unit + "</span></div>" +
      '<div class="foot">' + foot + "</div>" +
      '<div class="bar"><i style="width:' + Math.max(2, Math.min(100, pct)) + "%;background:" + color + '"></i></div>' +
      "</div>";
  }
  function task(icon, title, desc, go) {
    return '<div class="task" data-go="' + go + '">' +
      '<div class="ic" style="background:#f2f3f9">' + icon + "</div>" +
      '<div class="tx"><div class="tt">' + title + '</div><div class="td">' + desc + "</div></div>" +
      '<div class="go">›</div></div>';
  }

  window.ViewHome = View;
})();
