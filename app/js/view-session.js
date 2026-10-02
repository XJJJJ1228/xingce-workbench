/* ============================================================
 * 答题页 + 练习报告
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var S = null;     // 当前会话
  var showNav = false;

  var View = {};

  View.start = function (list, name) {
    S = {
      list: list,
      name: name,
      idx: 0,
      answers: {},        // qid -> {choice, correct, ms, ts}
      startAt: Date.now(),
      qStartAt: Date.now(),
      finished: false
    };
    $("#view-session").classList.add("active");
    render();
  };

  View.isActive = function () { return !!S && !S.finished; };

  function cur() { return S.list[S.idx]; }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!S) return;
    if (S.finished) { renderReport(); return; }
    var q = cur();
    var settings = Store.getSettings();
    var answered = S.answers[q.id];
    var fav = Store.isFav(q.id);

    var html = '<div class="session-wrap">';

    // 元信息
    html += '<div class="q-meta">' +
      '<span class="q-tag gray">' + esc(S.name) + "</span>" +
      '<span class="q-tag">' + esc(q.module) + "</span>" +
      '<span class="q-tag gray">' + esc(q.type) + (q.subtype ? " · " + esc(q.subtype) : "") + "</span>" +
      '<span class="q-tag gray">第 ' + (S.idx + 1) + " / " + S.list.length + " 题</span>" +
      '<div class="q-progress"><i style="width:' + ((S.idx + 1) / S.list.length * 100) + '%"></i></div>' +
      (settings.timerVisible ? '<span class="q-timer" id="qTimer">⏱ 00:00</span>' : "") +
      '<button class="btn sm" id="btnFav">' + (fav ? "★ 已收藏" : "☆ 收藏") + "</button>" +
      '<button class="btn sm" id="btnNavPad">' + (showNav ? "收起题卡" : "题卡") + "</button>" +
      "</div>";

    if (showNav) html += navPad();

    // 材料
    if (q.passage) {
      var prev = S.list[S.idx - 1];
      var sameAsPrev = prev && prev.groupId && prev.groupId === q.groupId;
      html += '<div class="passage">' + (sameAsPrev ? '<div class="hint" style="margin-bottom:6px">（接上篇材料）</div>' : "") + renderPassage(q.passage) + "</div>";
    }
    if (q.figure) {
      html += '<div class="figure-box">' + q.figure + "</div>";
    }

    // 题干
    html += '<div class="card card-pad"><div class="q-stem">' + esc(q.stem) + "</div>";

    // 选项
    html += '<div class="options" id="optBox">' + q.options.map(function (o, i) {
      var key = String.fromCharCode(65 + i);
      var cls = "opt";
      if (answered) {
        cls += " disabled";
        if (key === q.answer) cls += " correct";
        else if (key === answered.choice) cls += " wrong";
      } else if (S.picked === q.id + ":" + key) {
        cls += " selected";
      }
      return '<div class="' + cls + '" data-opt="' + key + '"><div class="key">' + key + '</div><div class="val">' + esc(o.replace(/^[A-D][．.、]\s*/, "")) + "</div></div>";
    }).join("") + "</div>";

    if (!answered) {
      html += '<div class="row"><button class="btn" id="btnPrevQ">上一题</button>' +
        '<button class="btn primary" id="btnConfirm" disabled>确认作答</button>' +
        '<button class="btn" id="btnSkip">跳过</button>' +
        '<span class="spacer"></span><span class="hint">选中选项后点击「确认作答」</span></div>';
    } else {
      html += analysisHtml(q, answered);
      html += '<div class="session-foot">' +
        '<button class="btn" id="btnPrevQ">上一题</button>' +
        (S.idx < S.list.length - 1 ? '<button class="btn primary" id="btnNextQ">下一题 →</button>' : '<button class="btn primary" id="btnFinish">交卷，查看报告</button>') +
        '<button class="btn" id="btnAddWrong">' + (Store.getWrongItem(q.id) ? "📕 已在错题本" : "📕 加入错题本") + "</button>" +
        '<span class="spacer"></span>' +
        '<span class="hint">已答 ' + Object.keys(S.answers).length + " / " + S.list.length + "</span>" +
        "</div>";
    }
    html += "</div>";

    html += '<div class="row row-end" style="margin-top:14px">' +
      '<button class="btn" id="btnQuit">结束本次练习</button>' +
      (Object.keys(S.answers).length ? '<button class="btn primary" id="btnFinish2">交卷</button>' : "") +
      "</div>";

    html += "</div>";

    $("#view-session").innerHTML = html;
    bind();
    updateTimer();
  }

  function navPad() {
    return '<div class="navpad">' + S.list.map(function (q, i) {
      var a = S.answers[q.id];
      var cls = "np" + (a ? (a.correct ? " right" : " wrong") : " done") + (i === S.idx ? " cur" : "");
      return '<div class="' + cls + '" data-jump="' + i + '">' + (i + 1) + "</div>";
    }).join("") + "</div>";
  }

  function analysisHtml(q, answered) {
    var ok = answered.correct;
    return '<div class="analysis">' +
      "<h4>" + (ok ? '<span class="verdict ok">✓ 回答正确</span>' : '<span class="verdict no">✗ 回答错误</span>') +
      '<span class="hint" style="margin-left:8px">你的答案 ' + answered.choice + " · 正确答案 " + q.answer + " · 用时 " + UI.fmtShort(answered.ms) + "</span></h4>" +
      '<div class="body">' + (q.analysis && q.analysis.trim() ? esc(q.analysis) : '<span style="color:var(--text-3)">暂无文字解析。可点击「收藏」后在收藏夹记笔记，或之后由我补充解析。</span>') + "</div>" +
      '<div class="ansline">答案：' + q.answer + "</div>" +
      (q.tags && q.tags.length ? '<div class="row" style="margin-top:10px">' + q.tags.map(function (t) { return '<span class="chip tag">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
      "</div>";
  }

  function renderPassage(p) {
    // 支持 Markdown 简易表格
    if (/\|\s*-{2,}/.test(p) && /\|/.test(p)) {
      var lines = p.split("\n");
      var out = [], inTable = false, buf = [];
      function flush() {
        if (!buf.length) return;
        out.push('<table>' + buf.join("") + "</table>");
        buf = [];
      }
      lines.forEach(function (ln) {
        var t = ln.trim();
        if (/^\|/.test(t)) {
          if (/^\|[\s:|-]+\|$/.test(t)) return;
          var cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); });
          if (!inTable) { inTable = true; buf.push("<tr>" + cells.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>"); }
          else buf.push("<tr>" + cells.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>");
        } else {
          flush(); inTable = false;
          if (t) out.push(esc(ln));
        }
      });
      flush();
      return out.join("<br>");
    }
    return esc(p);
  }

  /* ---------------- 交互 ---------------- */
  function bind() {
    var q = cur();

    $$("#optBox .opt").forEach(function (o) {
      if (o.classList.contains("disabled")) return;
      o.onclick = function () {
        if (S.answers[q.id]) return;
        S.picked = q.id + ":" + o.dataset.opt;
        $$("#optBox .opt").forEach(function (x) { x.classList.remove("selected"); });
        o.classList.add("selected");
        var cf = $("#btnConfirm"); if (cf) cf.disabled = false;
      };
    });

    var bConfirm = $("#btnConfirm");
    if (bConfirm) bConfirm.onclick = function () {
      if (!S.picked) return;
      answer(S.picked.split(":")[1]);
    };

    var bSkip = $("#btnSkip");
    if (bSkip) bSkip.onclick = function () { next(); };

    var bPrev = $("#btnPrevQ");
    if (bPrev) bPrev.onclick = function () { if (S.idx > 0) { S.idx--; S.qStartAt = Date.now(); render(); window.scrollTo(0, 0); } };

    var bNext = $("#btnNextQ");
    if (bNext) bNext.onclick = function () { next(); };

    var bFin = $("#btnFinish"); if (bFin) bFin.onclick = finish;
    var bFin2 = $("#btnFinish2"); if (bFin2) bFin2.onclick = finish;

    var bQuit = $("#btnQuit");
    if (bQuit) bQuit.onclick = function () { finish(); };

    var bFav = $("#btnFav");
    if (bFav) bFav.onclick = function () {
      var on = Store.toggleFav(q.id);
      bFav.textContent = on ? "★ 已收藏" : "☆ 收藏";
      UI.toast(on ? "已加入收藏题集" : "已取消收藏");
      App.refreshBadges();
    };

    var bNav = $("#btnNavPad");
    if (bNav) bNav.onclick = function () { showNav = !showNav; render(); };

    $$("#view-session .np").forEach(function (n) {
      n.onclick = function () { S.idx = +n.dataset.jump; S.qStartAt = Date.now(); render(); window.scrollTo(0, 0); };
    });

    var bAddWrong = $("#btnAddWrong");
    if (bAddWrong) bAddWrong.onclick = function () {
      addToWrong(q, true);
      bAddWrong.textContent = "📕 已在错题本";
      UI.toast("已加入错题本");
      App.refreshBadges();
    };
  }

  function answer(choice) {
    var q = cur();
    var now = Date.now();
    var ms = now - S.qStartAt;
    var correct = choice === q.answer;
    S.answers[q.id] = { choice: choice, correct: correct, ms: ms, ts: now };

    // 题目进度
    var prog = Store.getProgress();
    var p = prog[q.id] || { done: 0, correct: 0, wrong: 0, lastAt: 0 };
    p.done++; if (correct) p.correct++; else p.wrong++;
    p.lastAt = now; p.lastChoice = choice;
    prog[q.id] = p;
    Store.set("progress", prog);

    // 流水
    Store.addRecord({ ts: now, qid: q.id, module: q.module, type: q.type, subtype: q.subtype, correct: correct, duration: ms, choice: choice });

    // 每日统计
    Store.addDaily(ms, 1, correct ? 1 : 0);

    // 错题本
    if (!correct && Store.getSettings().autoAddWrong) addToWrong(q, false);
    if (correct) {
      var w = Store.getWrongItem(q.id);
      if (w) {
        w.rightCount = (w.rightCount || 0) + 1;
        w.lastReviewAt = now;
        if (w.rightCount >= 2 && (w.master || 0) < 3) w.master = Math.min(3, (w.master || 0) + 1);
        Store.setWrongItem(q.id, w);
      }
    }
    render();
    App.refreshBadges();
  }

  function next() {
    if (S.idx < S.list.length - 1) {
      S.idx++;
      S.qStartAt = Date.now();
      render();
      window.scrollTo(0, 0);
    } else finish();
  }

  function addToWrong(q, manual) {
    var w = Store.getWrongItem(q.id);
    var now = Date.now();
    if (!w) {
      w = {
        qid: q.id, addedAt: now, wrongCount: manual ? 0 : 1, rightCount: 0,
        master: 0, tags: [], note: "", lastWrongAt: manual ? 0 : now, lastReviewAt: 0
      };
    } else if (!manual) {
      w.wrongCount = (w.wrongCount || 0) + 1;
      w.lastWrongAt = now;
      w.master = 0;
    }
    Store.setWrongItem(q.id, w);
  }

  /* ---------------- 报告 ---------------- */
  function finish() {
    var now = Date.now();
    var total = S.list.length;
    var answeredIds = Object.keys(S.answers);
    var correct = 0, usedMs = 0;
    answeredIds.forEach(function (id) {
      var a = S.answers[id];
      if (a.correct) correct++;
      usedMs += a.ms;
    });
    var acc = answeredIds.length ? Math.round(correct / answeredIds.length * 100) : 0;

    Store.addSession({
      name: S.name, startAt: S.startAt, endAt: now, duration: usedMs,
      total: answeredIds.length, correct: correct, accuracy: acc,
      qids: S.list.map(function (q) { return q.id; })
    });

    S.finished = true;
    S.report = { total: answeredIds.length, correct: correct, accuracy: acc, ms: usedMs, wallMs: now - S.startAt };
    renderReport();
    App.refreshBadges();
    window.scrollTo(0, 0);
  }

  function renderReport() {
    var r = S.report;
    var wrongList = S.list.filter(function (q) { return S.answers[q.id] && !S.answers[q.id].correct; });
    var rightList = S.list.filter(function (q) { return S.answers[q.id] && S.answers[q.id].correct; });
    var skipped = S.list.length - r.total;

    var html = '<div class="session-wrap">';
    html += '<div class="report-top">' +
      '<div class="report-score">' + r.accuracy + "%</div>" +
      '<div class="report-meta">' +
      "<div>本次答对 <b>" + r.correct + "</b> / " + r.total + " 题" + (skipped ? "（跳过 " + skipped + " 题）" : "") + "</div>" +
      "<div>答题用时 <b>" + UI.fmtDuration(r.ms) + "</b> · 平均每题 " + (r.total ? Math.round(r.ms / r.total / 1000) : 0) + " 秒</div>" +
      "<div>错题 <b style='color:var(--red)'>" + wrongList.length + "</b> 题已自动进入错题本</div>" +
      "</div></div>";

    html += '<div class="row" style="margin-bottom:16px">' +
      '<button class="btn primary" id="rpReviewWrong"' + (wrongList.length ? "" : " disabled") + ">📕 立即复习错题（" + wrongList.length + "）</button>" +
      '<button class="btn" id="rpRedo">🔁 再来一组</button>' +
      '<button class="btn" id="rpBack">返回刷题</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn" id="rpDetail">查看逐题详情</button>' +
      "</div>";

    // 模块正确率
    var byMod = {};
    S.list.forEach(function (q) {
      var a = S.answers[q.id]; if (!a) return;
      byMod[q.module] = byMod[q.module] || { t: 0, c: 0 };
      byMod[q.module].t++; if (a.correct) byMod[q.module].c++;
    });
    if (Object.keys(byMod).length) {
      html += '<div class="card card-pad sec"><div class="sec-title">本组模块表现</div><div class="mod-list">' +
        Object.keys(byMod).map(function (m) {
          var x = byMod[m], a = Math.round(x.c / x.t * 100);
          var color = Bank.MODULE_META[m] ? Bank.MODULE_META[m].color : "#4f46e5";
          return '<div class="mod-row"><div class="mod-name"><span class="mod-dot" style="background:' + color + '"></span>' + m + "</div>" +
            '<div class="mod-bar"><i style="width:' + a + "%;background:" + color + '"></i></div>' +
            '<div class="mod-num"><b>' + a + "%</b> · " + x.t + " 题</div></div>";
        }).join("") + "</div></div>";
    }

    html += '<div id="rpDetailBox"></div>';
    html += "</div>";

    $("#view-session").innerHTML = html;

    $("#rpBack").onclick = function () { App.go("practice"); };
    $("#rpRedo").onclick = function () { App.startSession(Bank.query({ random: true, limit: S.list.length }), S.name); };
    $("#rpReviewWrong").onclick = function () {
      if (!wrongList.length) return;
      App.startSession(wrongList.slice(), "错题复习 · " + wrongList.length + "题");
    };
    $("#rpDetail").onclick = function () {
      var box = $("#rpDetailBox");
      if (box.innerHTML) { box.innerHTML = ""; $("#rpDetail").textContent = "查看逐题详情"; return; }
      $("#rpDetail").textContent = "收起详情";
      box.innerHTML = '<div class="sec-title" style="margin-top:8px">逐题详情</div><div class="list">' +
        S.list.map(function (q, i) {
          var a = S.answers[q.id];
          if (!a) return "";
          return '<div class="item"><div class="item-head">' +
            '<span class="q-tag gray">' + (i + 1) + "</span>" +
            '<span class="q-tag">' + esc(q.module) + " · " + esc(q.type) + "</span>" +
            (a.correct ? '<span class="q-tag green">✓ 正确</span>' : '<span class="q-tag" style="background:#fdeaef;color:#e11d48">✗ 错误</span>') +
            '<span class="hint">你的 ' + a.choice + " / 正确 " + q.answer + " · " + UI.fmtShort(a.ms) + "</span>" +
            '<span class="spacer"></span><button class="btn sm" data-fav="' + q.id + '">' + (Store.isFav(q.id) ? "★ 已收藏" : "☆ 收藏") + "</button></div>" +
            '<div class="item-body stem-clamp">' + esc(q.stem) + "</div>" +
            '<div class="item-foot"><button class="btn sm" data-show="' + q.id + '">展开解析</button></div>' +
            '<div class="item-body" id="an-' + q.id + '" style="display:none;margin-top:8px"></div>' +
            "</div>";
        }).join("") + "</div>";
      $$("#rpDetailBox button[data-show]").forEach(function (b) {
        b.onclick = function () {
          var q = Bank.get(b.dataset.show);
          var box2 = $("#an-" + q.id);
          if (box2.style.display === "none") { box2.style.display = "block"; box2.innerHTML = esc(q.analysis); b.textContent = "收起解析"; }
          else { box2.style.display = "none"; b.textContent = "展开解析"; }
        };
      });
      $$("#rpDetailBox button[data-fav]").forEach(function (b) {
        b.onclick = function () {
          var on = Store.toggleFav(b.dataset.fav);
          b.textContent = on ? "★ 已收藏" : "☆ 收藏";
          App.refreshBadges();
        };
      });
    };
  }

  /* ---------------- 计时器 ---------------- */
  var timerId = null;
  function updateTimer() {
    clearInterval(timerId);
    if (!S || S.finished) return;
    var el = $("#qTimer");
    if (!el) return;
    timerId = setInterval(function () {
      if (!el.parentNode) { clearInterval(timerId); return; }
      el.textContent = "⏱ " + UI.fmtClock(Date.now() - S.startAt);
    }, 1000);
  }

  View.cleanup = function () { clearInterval(timerId); S = null; };
  window.ViewSession = View;
})();
