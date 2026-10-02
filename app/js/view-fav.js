/* ============================================================
 * 收藏题集
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;
  var filter = { module: "全部", onlyWrong: false };

  var View = {};

  View.render = function () {
    var favs = Store.getFavs();
    var list = favs.map(function (id) { return Bank.get(id); }).filter(Boolean);
    if (filter.module !== "全部") list = list.filter(function (q) { return q.module === filter.module; });
    if (filter.onlyWrong) list = list.filter(function (q) { return !!Store.getWrongItem(q.id); });

    var html = '<div class="card card-pad sec" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
      '<div><div class="hint">收藏题数</div><div style="font-size:26px;font-weight:800">' + favs.length + "</div></div>" +
      '<span class="spacer"></span>' +
      '<button class="btn primary" id="fvStart"' + (list.length ? "" : " disabled") + ">开始刷这些题（" + list.length + "）</button>" +
      '<button class="btn" id="fvRandom">随机 20 题</button>' +
      "</div>";

    html += '<div class="card card-pad sec"><div class="filter-row"><span class="fl">模块</span>' +
      '<span class="chip' + (filter.module === "全部" ? " active" : "") + '" data-fm="全部">全部</span>' +
      Bank.MODULES.map(function (m) {
        var n = favs.filter(function (id) { var q = Bank.get(id); return q && q.module === m; }).length;
        return '<span class="chip' + (filter.module === m ? " active" : "") + '" data-fm="' + m + '">' + m + "（" + n + "）</span>";
      }).join("") +
      '<span class="chip' + (filter.onlyWrong ? " active" : "") + '" id="fvOnlyWrong">仅看错题</span>' +
      "</div></div>";

    if (!list.length) {
      html += '<div class="empty"><div class="big">☆</div>还没有收藏题目。做题时点击「☆ 收藏」，经典题和易混淆题就会集中在这里。</div>';
    } else {
      html += '<div class="sec-title">收藏题目 <span class="sub">共 ' + list.length + " 题</span></div>";
      html += '<div class="list">' + list.map(function (q) {
        var w = Store.getWrongItem(q.id);
        return '<div class="item">' +
          '<div class="item-head"><span class="q-tag">' + esc(q.module) + '</span><span class="q-tag gray">' + esc(q.type) + (q.subtype ? " · " + esc(q.subtype) : "") + "</span>" +
          (w ? '<span class="mlevel l' + (w.master || 0) + '">错题 · ' + ["未掌握", "模糊", "基本掌握", "已掌握"][w.master || 0] + "</span>" : "") +
          '<span class="spacer"></span><span class="hint">' + esc(q.source || "") + "</span></div>" +
          '<div class="item-body stem-clamp" data-open="' + q.id + '" style="cursor:pointer">' + esc(q.stem) + "</div>" +
          '<div class="item-foot"><span class="spacer"></span>' +
          '<button class="btn sm" data-open="' + q.id + '">查看解析</button>' +
          '<button class="btn sm" data-unfav="' + q.id + '">取消收藏</button></div>' +
          "</div>";
      }).join("") + "</div>";
    }

    $("#view-fav").innerHTML = html;

    $$("#view-fav .chip[data-fm]").forEach(function (c) { c.onclick = function () { filter.module = c.dataset.fm; View.render(); }; });
    var ow = $("#fvOnlyWrong");
    if (ow) ow.onclick = function () { filter.onlyWrong = !filter.onlyWrong; View.render(); };
    var st = $("#fvStart");
    if (st) st.onclick = function () { Bank.shuffle(list); App.startSession(list.slice(), "收藏题集 · " + list.length + "题"); };
    $("#fvRandom").onclick = function () {
      var p = list.slice(); Bank.shuffle(p); p = p.slice(0, 20);
      if (!p.length) { UI.toast("收藏夹是空的"); return; }
      App.startSession(p, "收藏随机 20 题");
    };
    $$("#view-fav [data-open]").forEach(function (b) { b.onclick = function () { openFav(b.dataset.open); }; });
    $$("#view-fav [data-unfav]").forEach(function (b) {
      b.onclick = function () { Store.setFav(b.dataset.unfav, false); UI.toast("已取消收藏"); View.render(); App.refreshBadges(); };
    });
  };

  function openFav(qid) {
    var q = Bank.get(qid);
    if (!q) return;
    var html = "<h3>收藏题目</h3>" +
      '<div class="row" style="margin-bottom:10px"><span class="q-tag">' + esc(q.module) + '</span><span class="q-tag gray">' + esc(q.type) + "</span></div>";
    if (q.passage) html += '<div class="passage" style="max-height:200px">' + esc(q.passage) + "</div>";
    if (q.figure) html += '<div class="figure-box">' + q.figure + "</div>";
    html += '<div class="q-stem">' + esc(q.stem) + "</div>";
    html += '<div class="options">' + q.options.map(function (o, i) {
      var k = String.fromCharCode(65 + i);
      return '<div class="opt disabled' + (k === q.answer ? " correct" : "") + '"><div class="key">' + k + '</div><div class="val">' + esc(o.replace(/^[A-D][．.、]\s*/, "")) + "</div></div>";
    }).join("") + "</div>";
    html += '<div class="analysis"><div class="body">' + esc(q.analysis) + '</div><div class="ansline">正确答案：' + q.answer + "</div></div>";
    html += '<div class="modal-foot"><button class="btn" id="fvUnfav">取消收藏</button><button class="btn primary" id="fvClose">关闭</button></div>';
    UI.modal(html, { width: "720px" });
    $("#fvClose").onclick = UI.closeModal;
    $("#fvUnfav").onclick = function () { Store.setFav(qid, false); UI.closeModal(); View.render(); App.refreshBadges(); };
  }

  window.ViewFav = View;
})();
