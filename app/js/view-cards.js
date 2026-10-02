/* ============================================================
 * 积累专区：成语 / 实词 / 政治常识 / 时事政治 卡片式背诵
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var CATS = ["成语", "实词", "政治常识", "时事政治"];
  var state = { cat: "成语", scope: "all", kw: "", flipped: {}, order: "default", page: 0, size: 24 };

  var View = {};

  function cardsOf(cat) {
    return (window.CARD_DATA || []).filter(function (c) { return c.category === cat; });
  }

  View.render = function (params) {
    if (params && params.cat) state.cat = params.cat;
    var all = cardsOf(state.cat);
    var prog = Store.getCardProgress();

    // 统计
    var learned = all.filter(function (c) { return prog[c.id] && prog[c.id].mastered; }).length;
    var starred = all.filter(function (c) { return prog[c.id] && prog[c.id].star; }).length;

    var list = all.filter(function (c) {
      var p = prog[c.id] || {};
      if (state.scope === "star" && !p.star) return false;
      if (state.scope === "unlearned" && p.mastered) return false;
      if (state.scope === "learned" && !p.mastered) return false;
      if (state.kw) {
        var t = (c.title + c.summary + c.detail + (c.example || "") + (c.tags || []).join("")).toLowerCase();
        if (t.indexOf(state.kw.toLowerCase()) < 0) return false;
      }
      return true;
    });
    if (state.order === "random") {
      list = list.slice().sort(function () { return Math.random() - 0.5; });
    }

    var total = all.length;
    var pct = total ? Math.round(learned / total * 100) : 0;

    var html = '<div class="card card-pad sec" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">' +
      '<div><div class="hint">本类词条</div><div style="font-size:26px;font-weight:800">' + total + "</div></div>" +
      '<div><div class="hint">已掌握</div><div style="font-size:26px;font-weight:800;color:var(--green)">' + learned + " <span style='font-size:14px;color:var(--text-3)'>(" + pct + "%)</span></div></div>" +
      '<div><div class="hint">已标星</div><div style="font-size:26px;font-weight:800;color:#f5b50a">' + starred + "</div></div>" +
      '<span class="spacer"></span>' +
      '<button class="btn primary" id="cdStudy">📖 背诵模式</button>' +
      '<button class="btn" id="cdRandom">🔀 随机打乱</button>' +
      "</div>";

    html += '<div class="card card-pad sec">' +
      '<div class="filter-row"><span class="fl">分类</span>' +
      CATS.map(function (c) {
        var n = cardsOf(c).length;
        return '<span class="chip' + (state.cat === c ? " active" : "") + '" data-cat="' + c + '">' + c + "（" + n + "）</span>";
      }).join("") + "</div>" +
      '<div class="filter-row"><span class="fl">筛选</span>' +
      [["all", "全部"], ["unlearned", "未掌握"], ["learned", "已掌握"], ["star", "已标星"]].map(function (s) {
        return '<span class="chip' + (state.scope === s[0] ? " active" : "") + '" data-scope="' + s[0] + '">' + s[1] + "</span>";
      }).join("") +
      '<span class="spacer"></span><input type="text" id="cdKw" placeholder="搜索词条 / 释义…" value="' + esc(state.kw) + '" style="width:220px"></div>' +
      "</div>";

    if (!list.length) {
      html += '<div class="empty"><div class="big">🗂</div>没有匹配的卡片</div>';
    } else {
      html += '<div class="sec-title">卡片 <span class="sub">共 ' + list.length + " 张 · 点击卡片翻面看详解</span></div>";
      html += '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">' +
        list.map(function (c) { return cardHtml(c, prog[c.id]); }).join("") + "</div>";
    }

    $("#view-cards").innerHTML = html;
    bind(list);
  };

  function cardHtml(c, p) {
    p = p || {};
    var flip = state.flipped[c.id];
    return '<div class="flip-card' + (p.mastered ? " learned" : "") + '" data-cid="' + c.id + '">' +
      '<div class="fc-top"><div class="fc-title">' + esc(c.title) + "</div>" +
      '<div class="fc-star' + (p.star ? " on" : "") + '" data-star="' + c.id + '">★</div></div>' +
      (flip
        ? '<div class="fc-detail">' + esc(c.detail) +
        (c.example ? '\n\n【例】' + esc(c.example) : "") +
        (c.confuse && c.confuse.length ? "\n\n【易混】" + esc(c.confuse.join("、")) : "") + "</div>"
        : '<div class="fc-sum">' + esc(c.summary || "") + "</div>") +
      '<div class="fc-foot">' +
      (c.tags || []).slice(0, 3).map(function (t) { return '<span class="chip" style="font-size:11px;padding:2px 8px">' + esc(t) + "</span>"; }).join("") +
      '<span class="spacer"></span>' +
      '<button class="btn sm" data-flip="' + c.id + '">' + (flip ? "收起" : "详解") + "</button>" +
      '<button class="btn sm' + (p.mastered ? " active" : "") + '" data-master="' + c.id + '">' + (p.mastered ? "✓ 已掌握" : "标掌握") + "</button>" +
      "</div></div>";
  }

  function bind(list) {
    $$("#view-cards .chip[data-cat]").forEach(function (c) {
      c.onclick = function () { state.cat = c.dataset.cat; state.flipped = {}; View.render(); };
    });
    $$("#view-cards .chip[data-scope]").forEach(function (c) {
      c.onclick = function () { state.scope = c.dataset.scope; View.render(); };
    });
    var kw = $("#cdKw");
    kw.oninput = function () { state.kw = kw.value.trim(); View.render(); var k = $("#cdKw"); k.focus(); k.setSelectionRange(k.value.length, k.value.length); };

    $("#cdRandom").onclick = function () { state.order = state.order === "random" ? "default" : "random"; View.render(); };
    $("#cdStudy").onclick = function () { studyMode(list); };

    $$("#view-cards [data-flip]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        state.flipped[b.dataset.flip] = !state.flipped[b.dataset.flip];
        View.render();
      };
    });
    $$("#view-cards [data-star]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var id = b.dataset.star;
        var p = Store.getCardStat(id) || {};
        p.star = !p.star; Store.setCardStat(id, p);
        b.classList.toggle("on", p.star);
      };
    });
    $$("#view-cards [data-master]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var id = b.dataset.master;
        var p = Store.getCardStat(id) || {};
        p.mastered = !p.mastered; p.lastAt = Date.now();
        Store.setCardStat(id, p);
        View.render();
      };
    });
    $$("#view-cards .flip-card").forEach(function (c) {
      c.onclick = function () {
        state.flipped[c.dataset.cid] = !state.flipped[c.dataset.cid];
        View.render();
      };
    });
  }

  /* ---------------- 背诵模式 ---------------- */
  var st = { list: [], i: 0, flip: false };
  function studyMode(list) {
    if (!list.length) { UI.toast("没有卡片"); return; }
    st.list = list.slice(); st.i = 0; st.flip = false;
    renderStudy();
  }

  function renderStudy() {
    var c = st.list[st.i];
    var p = Store.getCardStat(c.id) || {};
    var n = st.list.filter(function (x) { return (Store.getCardStat(x.id) || {}).mastered; }).length;
    var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span class="q-tag">' + esc(c.category) + "</span>" +
      '<span class="q-tag gray">第 ' + (st.i + 1) + " / " + st.list.length + " 张</span>" +
      '<span class="hint">已掌握 ' + n + "</span>" +
      '<span class="spacer"></span>' +
      '<span class="fc-star' + (p.star ? " on" : "") + '" id="sdStar" style="cursor:pointer;font-size:18px">★</span>' +
      "</div>" +
      '<div style="text-align:center;padding:26px 10px;min-height:190px">' +
      '<div style="font-size:26px;font-weight:800;margin-bottom:12px">' + esc(c.title) + "</div>" +
      (st.flip
        ? '<div style="text-align:left;font-size:14px;line-height:2;color:var(--text-2);white-space:pre-wrap;max-height:340px;overflow:auto">' + esc(c.detail) +
        (c.example ? "\n\n【例】" + esc(c.example) : "") +
        (c.confuse && c.confuse.length ? "\n\n【易混辨析】" + esc(c.confuse.join("、")) : "") + "</div>"
        : '<div style="font-size:16px;color:var(--text-2);line-height:2">' + esc(c.summary || "（点击查看详解）") + "</div>") +
      "</div>" +
      '<div class="row row-end" style="margin-top:16px">' +
      '<button class="btn" id="sdPrev">上一张</button>' +
      '<button class="btn primary" id="sdFlip">' + (st.flip ? "收起详解" : "翻开详解（空格）") + "</button>" +
      '<button class="btn" id="sdMaster">' + (p.mastered ? "✓ 已掌握" : "标记掌握") + "</button>" +
      '<button class="btn" id="sdNext">下一张 →</button>' +
      '<button class="btn" id="sdClose">结束</button>' +
      "</div>";
    UI.modal(html, { width: "620px" });

    $("#sdFlip").onclick = function () { st.flip = !st.flip; renderStudy(); };
    $("#sdPrev").onclick = function () { if (st.i > 0) { st.i--; st.flip = false; renderStudy(); } };
    $("#sdNext").onclick = function () {
      if (st.i < st.list.length - 1) { st.i++; st.flip = false; renderStudy(); }
      else { UI.toast("这一轮背完啦 🎉"); UI.closeModal(); View.render(); }
    };
    $("#sdMaster").onclick = function () {
      var p2 = Store.getCardStat(c.id) || {};
      p2.mastered = !p2.mastered; p2.lastAt = Date.now();
      Store.setCardStat(c.id, p2);
      renderStudy();
    };
    var star = $("#sdStar");
    star.onclick = function () {
      var p2 = Store.getCardStat(c.id) || {};
      p2.star = !p2.star; Store.setCardStat(c.id, p2);
      star.classList.toggle("on", p2.star);
    };
    $("#sdClose").onclick = function () { UI.closeModal(); View.render(); };

    document.onkeydown = function (e) {
      if (!$("#modalMask").classList.contains("show")) return;
      if (e.key === "Escape") { UI.closeModal(); return; }
      if (e.code === "Space") { e.preventDefault(); st.flip = !st.flip; renderStudy(); }
      if (e.code === "ArrowRight" && $("#sdNext")) $("#sdNext").click();
      if (e.code === "ArrowLeft" && $("#sdPrev")) $("#sdPrev").click();
    };
  }

  window.ViewCards = View;
})();
