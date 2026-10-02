/* ============================================================
 * 学习统计
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, esc = UI.esc;

  var View = {};

  View.render = function () {
    var o = StatLib.overview();
    var mods = StatLib.byModule();
    var types = StatLib.byType();
    var daily = StatLib.daily(30);
    var daily14 = StatLib.daily(14);
    var trend = daily14.map(function (x) { return x.count ? Math.round(x.correct / x.count * 100) : 0; });
    var records = Store.getRecords();
    var totalMs = daily.reduce(function (s, x) { return s + x.ms; }, 0);
    var avgSpeed = records.length ? Math.round(records.reduce(function (s, r) { return s + (r.duration || 0); }, 0) / records.length / 1000) : 0;

    var html = "";
    html += '<div class="stat-grid sec">' +
      sc("累计刷题", o.done, "题", "题库覆盖 " + Math.round(o.done / Math.max(1, Bank.count()) * 100) + "%") +
      sc("累计学习时长", (totalMs / 3600000).toFixed(1), "h", "近 30 天 " + (totalMs / 3600000).toFixed(1) + " 小时") +
      sc("平均正确率", o.accuracy, "%", "答对 " + o.correct + " 题") +
      sc("连续打卡", o.streak, "天", "平均每题 " + avgSpeed + " 秒") +
      "</div>";

    html += '<div class="grid sec" style="grid-template-columns:1.6fr 1fr">' +
      '<div class="card card-pad"><div class="sec-title">近 14 天正确率趋势</div><div class="chart-box"><canvas id="stLine"></canvas></div></div>' +
      '<div class="card card-pad"><div class="sec-title">模块掌握度</div><div class="chart-box"><canvas id="stRadar"></canvas></div>' +
      '<div class="hint" style="text-align:center;margin-top:6px">按各模块正确率绘制，未做的模块记为 0</div></div>' +
      "</div>";

    html += '<div class="card card-pad sec"><div class="sec-title">近 30 天刷题量</div><div class="chart-box"><canvas id="stBar"></canvas></div></div>';

    // 模块明细
    html += '<div class="card card-pad sec"><div class="sec-title">模块明细</div>' +
      '<table class="tbl"><thead><tr><th>模块</th><th>题库</th><th>已做</th><th>覆盖率</th><th>正确率</th><th>错题 / 待复习</th><th>状态</th></tr></thead><tbody>' +
      mods.map(function (m) {
        var wrongN = 0, dueN = 0;
        var w = Store.getWrong();
        Object.keys(w).forEach(function (id) {
          var q = Bank.get(id); if (!q || q.module !== m.module) return;
          wrongN++;
          if ((w[id].master || 0) < 3 && Date.now() >= (w[id].lastReviewAt || w[id].addedAt) + StatLib.intervalOf(w[id].master || 0) * 86400000) dueN++;
        });
        var status = m.done === 0 ? "未开始" : m.accuracy >= 80 ? "优秀" : m.accuracy >= 65 ? "良好" : m.accuracy >= 50 ? "需加强" : "薄弱";
        var color = m.done === 0 ? "#8b90a3" : m.accuracy >= 80 ? "#059669" : m.accuracy >= 65 ? "#0891b2" : m.accuracy >= 50 ? "#d97706" : "#e11d48";
        return "<tr><td><b>" + m.module + "</b></td><td>" + m.total + "</td><td>" + m.done + "</td>" +
          "<td>" + m.coverage + "%</td>" +
          '<td style="color:' + color + ';font-weight:700">' + (m.done ? m.accuracy + "%" : "—") + "</td>" +
          "<td>" + wrongN + " / <b style='color:#e11d48'>" + dueN + "</b></td>" +
          '<td><span class="mlevel" style="background:' + color + '22;color:' + color + '">' + status + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";

    // 题型明细
    html += '<div class="card card-pad sec"><div class="sec-title">题型正确率（升序：越靠上越需要补）</div>' +
      (types.length ? '<table class="tbl"><thead><tr><th>模块 / 题型</th><th>已做</th><th>答对</th><th>正确率</th></tr></thead><tbody>' +
        types.map(function (t) {
          var color = t.accuracy >= 80 ? "#059669" : t.accuracy >= 60 ? "#d97706" : "#e11d48";
          return "<tr><td>" + esc(t.module) + " · <b>" + esc(t.type) + "</b></td><td>" + t.done + "</td><td>" + t.correct + '</td><td style="color:' + color + ';font-weight:700">' + t.accuracy + "%</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="empty">还没有做题数据</div>') +
      "</div>";

    // 建议
    var weak = types.filter(function (t) { return t.done >= 3 && t.accuracy < 65; }).slice(0, 5);
    html += '<div class="card card-pad sec"><div class="sec-title">备考建议</div><div style="font-size:13.5px;line-height:2;color:var(--text-2)">' +
      (weak.length ? "① 优先补强：" + weak.map(function (t) { return "<b>" + esc(t.type) + "</b>（" + t.accuracy + "%）"; }).join("、") + "。<br>" : "① 各题型正确率都不错，保持节奏。<br>") +
      "② 每天先花 10 分钟复习错题（当前待复习 <b>" + o.due + "</b> 题），再刷新题。<br>" +
      "③ 言语和常识靠积累，每天背诵 20 张卡片，坚持一周见效。<br>" +
      "④ 当前连续打卡 <b>" + o.streak + "</b> 天，日目标 " + Store.getSettings().dailyGoal + " 题，今天已完成 " + o.today.count + " 题。" +
      "</div></div>";

    $("#view-stats").innerHTML = html;

    UI.lineChart($("#stLine"), daily14.map(function (x) { return x.label; }), trend, { height: 200, max: 100, min: 0, suffix: "%" });
    UI.radarChart($("#stRadar"), mods.map(function (m) { return m.module; }), mods.map(function (m) { return m.accuracy; }), { size: 270 });
    UI.barChart($("#stBar"), daily.map(function (x) { return x.label; }), daily.map(function (x) { return x.count; }), { height: 190 });
  };

  function sc(label, value, unit, foot) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="value" style="color:var(--primary)">' + value +
      '<span class="unit">' + unit + '</span></div><div class="foot">' + foot + "</div></div>";
  }

  window.ViewStats = View;
})();
