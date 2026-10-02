/* ============================================================
 * 设置
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var View = {};

  View.render = function () {
    var s = Store.getSettings();
    var html = '<div class="grid g2 sec">';

    html += '<div class="card card-pad"><div class="sec-title">刷题设置</div>' +
      '<label class="field" style="margin-bottom:12px">单次刷题题量（1-200）' +
      '<input type="number" id="stCount" min="1" max="200" value="' + s.questionCount + '"></label>' +
      '<label class="field" style="margin-bottom:12px">每日目标题量' +
      '<input type="number" id="stGoal" min="1" max="300" value="' + s.dailyGoal + '"></label>' +
      '<label class="field" style="margin-bottom:12px">错题每日复习上限' +
      '<input type="number" id="stReview" min="5" max="200" value="' + s.reviewPerDay + '"></label>' +
      '<div class="row"><label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" id="stAuto"' + (s.autoAddWrong ? " checked" : "") + '>做错自动加入错题本</label></div>' +
      '<div class="row" style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" id="stTimer"' + (s.timerVisible ? " checked" : "") + '>答题页显示计时器</label></div>' +
      '<div class="row row-end" style="margin-top:14px"><button class="btn primary" id="stSave">保存设置</button></div>' +
      "</div>";

    html += '<div class="card card-pad"><div class="sec-title">数据管理</div>' +
      '<div class="hint" style="margin-bottom:10px">数据全部保存在本机浏览器（localStorage）。清理浏览器缓存前请先导出备份。</div>' +
      '<div class="row"><button class="btn" id="stExport">导出备份</button>' +
      '<button class="btn" id="stImport">导入备份</button>' +
      '<input type="file" id="stFile" accept=".json" style="display:none"></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn danger" id="stClearPractice">清空练习记录（保留题库与收藏）</button></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn danger" id="stClearAll">清空全部数据（恢复出厂）</button></div>' +
      '<div class="hint" style="margin-top:12px">当前占用：约 ' + (Store.usage() / 1024).toFixed(1) + " KB</div>" +
      "</div>";

    html += "</div>";

    html += '<div class="card card-pad sec"><div class="sec-title">题库信息</div>' +
      '<table class="tbl"><thead><tr><th>模块</th><th>内置题量</th><th>小题型</th></tr></thead><tbody>' +
      Bank.MODULES.map(function (m) {
        var n = Bank.all().filter(function (q) { return q.module === m; }).length;
        return "<tr><td><b>" + m + "</b></td><td>" + n + "</td><td>" + (Bank.TYPES[m] || []).join("、") + "</td></tr>";
      }).join("") +
      '<tr><td><b>合计</b></td><td><b>' + Bank.count() + "</b>（内置 " + Bank.builtinCount() + " + 导入 " + Bank.customCount() + "）</td><td></td></tr>" +
      "</tbody></table>" +
      '<div class="hint" style="margin-top:8px">积累卡片：' +
      ["成语", "实词", "政治常识", "时事政治"].map(function (c) {
        var n = (window.CARD_DATA || []).filter(function (x) { return x.category === c; }).length;
        return c + " " + n + " 条";
      }).join(" · ") + "</div></div>";

    html += '<div class="card card-pad sec"><div class="sec-title">安装到桌面</div>' +
      '<div style="font-size:13.5px;line-height:2;color:var(--text-2)">' +
      "<b>📱 手机端：</b>用 <b>Safari / Chrome</b> 打开在线地址（微信里打开请点右上角「···」→ 在浏览器中打开）：<br>" +
      "　· iPhone：底部「分享」→「添加到主屏幕」<br>" +
      "　· 安卓：右上角菜单 →「安装应用」或「添加到主屏幕」<br>" +
      "装好后是一个独立图标，打开无地址栏，断网也能刷题。<br><br>" +
      "<b>💻 电脑端：</b>用 Edge / Chrome 打开后，点击地址栏右侧「安装」图标，或菜单 →「应用」→「安装此站点为应用」。<br>" +
      "另一种方式：双击本项目的 <code>行测工作台.vbs</code>（或 <code>启动行测工作台.bat</code>），自动启动本地服务并打开独立窗口。<br><br>" +
      "<b>⚠️ 数据说明：</b>手机端与电脑端的数据相互独立（分别存在各自浏览器里）。要同步进度，请在「导入 / 备份」里<b>导出备份</b>，在另一端<b>导入</b>即可合并。" +
      "</div></div>";

    $("#view-settings").innerHTML = html;

    $("#stSave").onclick = function () {
      Store.setSettings({
        questionCount: Math.max(1, Math.min(200, +$("#stCount").value || 20)),
        dailyGoal: Math.max(1, Math.min(300, +$("#stGoal").value || 30)),
        reviewPerDay: Math.max(5, Math.min(200, +$("#stReview").value || 20)),
        autoAddWrong: $("#stAuto").checked,
        timerVisible: $("#stTimer").checked
      });
      UI.toast("设置已保存");
    };

    $("#stExport").onclick = function () {
      UI.download("行测工作台备份-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(Store.exportAll(), null, 2));
    };
    var sf = $("#stFile");
    $("#stImport").onclick = function () { sf.click(); };
    sf.onchange = function () {
      if (!sf.files[0]) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          Store.importAll(d, true); Bank.reload(); UI.toast("已合并导入"); App.refreshBadges(); View.render();
        } catch (e) { UI.toast("解析失败"); }
      };
      r.readAsText(sf.files[0], "utf-8");
      sf.value = "";
    };
    $("#stClearPractice").onclick = function () {
      UI.confirmBox("<b>⚠️ 将清空所有做题记录、错题本和学习时长</b><br>收藏、卡片进度和导入的题目会保留。建议先导出备份。", function () {
        Store.clearPracticeData(); UI.toast("练习数据已清空"); App.go("home");
      }, "确认清空");
    };
    $("#stClearAll").onclick = function () {
      UI.confirmBox("<b>⚠️ 将清空全部数据（含收藏、错题、卡片进度、导入的题目）</b><br>此操作不可恢复！确定要继续吗？", function () {
        Store.clearAll(); Bank.reload(); UI.toast("已恢复出厂设置"); App.go("home");
      }, "我确定，全部清空");
    };
  };

  window.ViewSettings = View;
})();
