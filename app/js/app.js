/* ============================================================
 * app.js —— 路由与初始化
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var VIEWS = {
    home: { title: "首页看板", render: function (p) { ViewHome.render(p); } },
    practice: { title: "刷题练习", render: function (p) { ViewPractice.render(p); } },
    session: { title: "答题中", render: function () { } },
    wrong: { title: "错题本", render: function () { ViewWrong.render(); } },
    fav: { title: "收藏题集", render: function () { ViewFav.render(); } },
    cards: { title: "积累专区", render: function (p) { ViewCards.render(p); } },
    stats: { title: "学习统计", render: function () { ViewStats.render(); } },
    import: { title: "导入 / 备份", render: function () { ViewImport.render(); } },
    settings: { title: "设置", render: function () { ViewSettings.render(); } }
  };

  var current = "home";

  var App = {
    go: function (name, params) {
      if (!VIEWS[name]) name = "home";
      if (name !== "session" && current === "session") {
        var btn = confirmLeave();
        if (!btn) return;
      }
      current = name;
      $$(".view").forEach(function (v) { v.classList.remove("active"); });
      $("#view-" + name).classList.add("active");
      $("#topbarTitle").textContent = VIEWS[name].title;
      $$("#nav .nav-item").forEach(function (n) { n.classList.toggle("active", n.dataset.view === name); });
      if (name !== "session") ViewSession.cleanup();
      VIEWS[name].render(params || {});
      window.scrollTo(0, 0);
      document.getElementById("sidebar").classList.remove("open");
    },

    startSession: function (list, name) {
      ViewSession.cleanup();
      current = "session";
      $$(".view").forEach(function (v) { v.classList.remove("active"); });
      $("#view-session").classList.add("active");
      $("#topbarTitle").textContent = name;
      $$("#nav .nav-item").forEach(function (n) { n.classList.toggle("active", false); });
      ViewSession.start(list, name);
      window.scrollTo(0, 0);
    },

    refreshBadges: function () {
      var due = StatLib.dueWrongIds().length;
      var wrong = Object.keys(Store.getWrong()).length;
      var fav = Store.getFavs().length;
      var b1 = $("#badgeDue"), b2 = $("#badgeWrong"), b3 = $("#badgeFav");
      b1.textContent = due; b1.classList.toggle("show", due > 0);
      b2.textContent = wrong; b2.classList.toggle("show", wrong > 0);
      b3.textContent = fav; b3.classList.toggle("show", fav > 0);
      var st = StatLib.streak();
      $("#streakBox").textContent = st > 0 ? "🔥 连续 " + st + " 天" : "今天还没开始";
      $("#bankInfo").textContent = "题库 " + Bank.count() + " 题 · 卡片 " + (window.CARD_DATA || []).length + " 张";
    }
  };

  function confirmLeave() {
    return true; // 答题数据实时保存，允许随时离开
  }

  /* ---------------- 全局搜索 ---------------- */
  function globalSearch(kw) {
    kw = (kw || "").trim();
    if (!kw) return;
    var qs = Bank.query({ keyword: kw, limit: 30 });
    var cards = (window.CARD_DATA || []).filter(function (c) {
      return (c.title + c.summary + c.detail).toLowerCase().indexOf(kw.toLowerCase()) >= 0;
    }).slice(0, 20);

    var html = "<h3>搜索：" + esc(kw) + "</h3>";
    html += '<div class="hint" style="margin-bottom:10px">题目 ' + qs.length + " 条 · 卡片 " + cards.length + " 条</div>";
    if (qs.length) {
      html += '<div class="sec-title" style="font-size:13px">题目</div><div class="list">' + qs.map(function (q) {
        return '<div class="item"><div class="item-head"><span class="q-tag">' + esc(q.module) + '</span><span class="q-tag gray">' + esc(q.type) + "</span>" +
          '<span class="spacer"></span><button class="btn sm" data-sopen="' + q.id + '">查看</button>' +
          '<button class="btn sm" data-sfav="' + q.id + '">' + (Store.isFav(q.id) ? "★" : "☆") + "</button></div>" +
          '<div class="item-body stem-clamp">' + esc(q.stem) + "</div></div>";
      }).join("") + "</div>";
    }
    if (cards.length) {
      html += '<div class="sec-title" style="font-size:13px;margin-top:14px">积累卡片</div><div class="list">' + cards.map(function (c) {
        return '<div class="item"><div class="item-head"><span class="q-tag">' + esc(c.category) + "</span><b>" + esc(c.title) + "</b></div>" +
          '<div class="item-body">' + esc(c.summary) + "</div></div>";
      }).join("") + "</div>";
    }
    if (!qs.length && !cards.length) html += '<div class="empty">没有找到相关内容</div>';
    html += '<div class="modal-foot"><button class="btn primary" id="srClose">关闭</button></div>';
    UI.modal(html, { width: "700px" });
    $("#srClose").onclick = UI.closeModal;
    $$("#modalBox [data-sopen]").forEach(function (b) {
      b.onclick = function () {
        var q = Bank.get(b.dataset.sopen);
        var h = "<h3>" + esc(q.module) + " · " + esc(q.type) + "</h3>";
        if (q.passage) h += '<div class="passage" style="max-height:180px">' + esc(q.passage) + "</div>";
        if (q.figure) h += '<div class="figure-box">' + q.figure + "</div>";
        h += '<div class="q-stem">' + esc(q.stem) + "</div>" +
          '<div class="options">' + q.options.map(function (o, i) {
            var k = String.fromCharCode(65 + i);
            return '<div class="opt disabled' + (k === q.answer ? " correct" : "") + '"><div class="key">' + k + '</div><div class="val">' + esc(o) + "</div></div>";
          }).join("") + "</div>" +
          '<div class="analysis"><div class="body">' + esc(q.analysis) + "</div></div>" +
          '<div class="modal-foot"><button class="btn primary" id="srBack">返回</button></div>';
        UI.modal(h, { width: "700px" });
        $("#srBack").onclick = function () { globalSearch(kw); };
      };
    });
    $$("#modalBox [data-sfav]").forEach(function (b) {
      b.onclick = function () {
        var on = Store.toggleFav(b.dataset.sfav);
        b.textContent = on ? "★" : "☆";
        App.refreshBadges();
      };
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    Bank.load();

    $$("#nav .nav-item").forEach(function (n) {
      n.onclick = function () { App.go(n.dataset.view); };
    });

    $("#btnToggleSidebar").onclick = function () { $("#sidebar").classList.toggle("open"); };

    var searchTimer = null;
    $("#globalSearch").onkeydown = function (e) {
      if (e.key === "Enter") { clearTimeout(searchTimer); globalSearch(this.value); }
    };

    // ESC 关闭弹层
    document.onkeydown = function (e) {
      if (e.key === "Escape") UI.closeModal();
    };

    App.refreshBadges();
    App.go("home");

    // 首次使用提示
    if (!Store.get("welcomed")) {
      setTimeout(function () {
        UI.modal('<h3>欢迎使用行测工作台 🎯</h3>' +
          '<div style="font-size:13.5px;line-height:2;color:var(--text-2)">' +
          "· 内置 <b>" + Bank.count() + "</b> 道题（五大模块 · 全带详细解析）+ <b>" + (window.CARD_DATA || []).length + "</b> 张积累卡片<br>" +
          "· 做错的题会自动进<b>错题本</b>，可打标签、二次作答、标记掌握程度<br>" +
          "· 想加新题：在「导入 / 备份」里上传 json / csv / txt，或直接把题目发给 AI 助手<br>" +
          "· 所有数据存在本机，更新题库不会丢失。建议每周导出一次备份。" +
          '</div><div class="modal-foot"><button class="btn primary" id="wkOk">开始备考</button></div>', { width: "560px" });
        $("#wkOk").onclick = function () { UI.closeModal(); Store.set("welcomed", 1); };
        Store.set("welcomed", 1);
      }, 600);
    }

    // 窗口尺寸变化时重绘图表
    var rt = null;
    window.onresize = function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (current === "home") ViewHome.render();
        if (current === "stats") ViewStats.render();
      }, 300);
    };

    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { });
    }
  }

  window.App = App;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
