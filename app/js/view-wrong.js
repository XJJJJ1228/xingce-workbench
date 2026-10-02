/* ============================================================
 * 错题本：标签管理 / 二次作答 / 掌握程度 / 复习
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  var filter = {
    module: "全部", type: "全部", tag: "全部", master: "全部",
    sort: "time", keyword: ""
  };

  var View = {};

  View.render = function () {
    var wrong = Store.getWrong();
    var ids = Object.keys(wrong);
    var now = Date.now();
    var stats = { total: ids.length, due: 0, mastered: 0, neverReviewed: 0 };
    ids.forEach(function (id) {
      var it = wrong[id];
      if (it.master >= 3) stats.mastered++;
      else if (now >= (it.lastReviewAt || it.addedAt) + StatLib.intervalOf(it.master) * 86400000) stats.due++;
      if (!it.lastReviewAt) stats.neverReviewed++;
    });

    var tags = Store.getTags();
    var list = filterList();

    var html = "";

    html += '<div class="card card-pad sec" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
      '<div><div class="hint">错题总数</div><div style="font-size:26px;font-weight:800;color:var(--text)">' + stats.total + "</div></div>" +
      '<div><div class="hint">待复习</div><div style="font-size:26px;font-weight:800;color:var(--red)">' + stats.due + "</div></div>" +
      '<div><div class="hint">已掌握</div><div style="font-size:26px;font-weight:800;color:var(--green)">' + stats.mastered + "</div></div>" +
      '<div><div class="hint">未复习过</div><div style="font-size:26px;font-weight:800;color:var(--amber)">' + stats.neverReviewed + "</div></div>" +
      '<span class="spacer"></span>' +
      '<button class="btn primary" id="btnReviewDue"' + (stats.due ? "" : " disabled") + ">开始复习到期错题（" + stats.due + "）</button>" +
      '<button class="btn" id="btnReviewAll">全部重刷</button>' +
      '<button class="btn" id="btnManageTag">标签管理</button>' +
      "</div>";

    // 筛选
    html += '<div class="card card-pad sec">';
    html += '<div class="filter-row"><span class="fl">模块</span><span class="chip' + (filter.module === "全部" ? " active" : "") + '" data-fm="全部">全部</span>' +
      Bank.MODULES.map(function (m) { return '<span class="chip' + (filter.module === m ? " active" : "") + '" data-fm="' + m + '">' + m + "</span>"; }).join("") + "</div>";

    html += '<div class="filter-row"><span class="fl">掌握度</span>' +
      [["全部", "全部"], ["0", "未掌握"], ["1", "模糊"], ["2", "基本掌握"], ["3", "已掌握"]].map(function (m) {
        return '<span class="chip' + (filter.master === m[0] ? " active" : "") + '" data-fma="' + m[0] + '">' + m[1] + "</span>";
      }).join("") + "</div>";

    html += '<div class="filter-row"><span class="fl">标签</span><span class="chip' + (filter.tag === "全部" ? " active" : "") + '" data-ft="全部">全部</span>' +
      tags.map(function (t) { return '<span class="chip tag' + (filter.tag === t ? " active" : "") + '" data-ft="' + esc(t) + '">' + esc(t) + "</span>"; }).join("") +
      '<span class="chip" id="btnAddTag" style="border:1px dashed var(--line)">＋ 新标签</span>' +
      "</div>";

    html += '<div class="filter-row"><span class="fl">排序</span>' +
      [["time", "最近加入"], ["wrong", "错误次数多"], ["old", "最久没复习"], ["master", "掌握度低"]].map(function (s) {
        return '<span class="chip' + (filter.sort === s[0] ? " active" : "") + '" data-fs="' + s[0] + '">' + s[1] + "</span>";
      }).join("") +
      '<span class="spacer"></span><input type="text" id="wrongKw" placeholder="搜索题干关键词…" value="' + esc(filter.keyword) + '" style="width:200px">' +
      "</div>";
    html += "</div>";

    // 列表
    html += '<div class="sec-title">错题列表 <span class="sub">共 ' + list.length + " 题</span></div>";
    if (!list.length) {
      html += '<div class="empty"><div class="big">📕</div>' + (ids.length ? "当前筛选条件下没有错题" : "还没有错题，去刷题吧！做错的题会自动进这里") + "</div>";
    } else {
      html += '<div class="list">' + list.map(itemHtml).join("") + "</div>";
    }

    $("#view-wrong").innerHTML = html;
    bind();
  };

  function filterList() {
    var wrong = Store.getWrong();
    var now = Date.now();
    var out = Object.keys(wrong).map(function (id) {
      var q = Bank.get(id);
      return q ? { q: q, it: wrong[id] } : null;
    }).filter(function (x) {
      if (!x) return false;
      if (filter.module !== "全部" && x.q.module !== filter.module) return false;
      if (filter.master !== "全部" && String(x.it.master || 0) !== filter.master) return false;
      if (filter.tag !== "全部" && (x.it.tags || []).indexOf(filter.tag) < 0) return false;
      if (filter.keyword && (x.q.stem + x.q.analysis + (x.q.tags || []).join("")).toLowerCase().indexOf(filter.keyword.toLowerCase()) < 0) return false;
      return true;
    });
    out.sort(function (a, b) {
      if (filter.sort === "wrong") return (b.it.wrongCount || 0) - (a.it.wrongCount || 0);
      if (filter.sort === "old") return (a.it.lastReviewAt || a.it.addedAt) - (b.it.lastReviewAt || b.it.addedAt);
      if (filter.sort === "master") return (a.it.master || 0) - (b.it.master || 0);
      return b.it.addedAt - a.it.addedAt;
    });
    return out;
  }

  var MASTER_NAME = ["未掌握", "模糊", "基本掌握", "已掌握"];

  function itemHtml(x) {
    var q = x.q, it = x.it;
    var m = it.master || 0;
    var due = m < 3 && Date.now() >= (it.lastReviewAt || it.addedAt) + StatLib.intervalOf(m) * 86400000;
    return '<div class="item" data-wid="' + q.id + '">' +
      '<div class="item-head">' +
      '<span class="q-tag">' + esc(q.module) + "</span>" +
      '<span class="q-tag gray">' + esc(q.type) + (q.subtype ? " · " + esc(q.subtype) : "") + "</span>" +
      '<span class="mlevel l' + m + '">' + MASTER_NAME[m] + "</span>" +
      (due ? '<span class="q-tag" style="background:#fdeaef;color:#e11d48">待复习</span>' : "") +
      '<span class="hint">错 ' + (it.wrongCount || 0) + " 次 · 答对 " + (it.rightCount || 0) + " 次 · " + UI.daysAgo(it.addedAt) + "加入</span>" +
      '<span class="spacer"></span>' +
      '<div class="master" data-master="' + q.id + '">' +
      [0, 1, 2, 3].map(function (i) {
        return '<i data-mv="' + i + '" class="' + (i <= m ? (m === 0 ? "low" : m === 3 ? "on" : "mid") : "") + '" title="设为 ' + MASTER_NAME[i] + '"></i>';
      }).join("") + "</div>" +
      "</div>" +
      '<div class="item-body stem-clamp" style="cursor:pointer" data-open="' + q.id + '">' + esc(q.stem) + "</div>" +
      '<div class="item-foot">' +
      (it.tags || []).map(function (t) { return '<span class="chip tag">' + esc(t) + "</span>"; }).join("") +
      '<span class="spacer"></span>' +
      '<button class="btn sm" data-open="' + q.id + '">查看原题</button>' +
      '<button class="btn sm primary" data-redo="' + q.id + '">二次作答</button>' +
      '<button class="btn sm" data-tag="' + q.id + '">打标签</button>' +
      '<button class="btn sm danger" data-del="' + q.id + '">移出</button>' +
      "</div></div>";
  }

  function bind() {
    $$("#view-wrong .chip[data-fm]").forEach(function (c) { c.onclick = function () { filter.module = c.dataset.fm; View.render(); }; });
    $$("#view-wrong .chip[data-fma]").forEach(function (c) { c.onclick = function () { filter.master = c.dataset.fma; View.render(); }; });
    $$("#view-wrong .chip[data-ft]").forEach(function (c) { c.onclick = function () { filter.tag = c.dataset.ft; View.render(); }; });
    $$("#view-wrong .chip[data-fs]").forEach(function (c) { c.onclick = function () { filter.sort = c.dataset.fs; View.render(); }; });
    var kw = $("#wrongKw");
    if (kw) kw.oninput = function () { filter.keyword = kw.value.trim(); View.render(); var k2 = $("#wrongKw"); k2.focus(); k2.setSelectionRange(k2.value.length, k2.value.length); };

    $("#btnAddTag").onclick = function () {
      UI.modal('<h3>新增自定义标签</h3><input type="text" id="newTagInput" placeholder="如：资料分析速算慢" style="width:100%" maxlength="12">' +
        '<div class="modal-foot"><button class="btn" id="tgCancel">取消</button><button class="btn primary" id="tgOk">添加</button></div>', { width: "420px" });
      $("#newTagInput").focus();
      $("#tgCancel").onclick = UI.closeModal;
      $("#tgOk").onclick = function () {
        var v = $("#newTagInput").value.trim();
        if (!v) return;
        if (Store.addTag(v)) { UI.toast("已添加标签：" + v); } else UI.toast("标签已存在");
        UI.closeModal(); View.render();
      };
    };

    $("#btnManageTag").onclick = manageTags;
    var bDue = $("#btnReviewDue");
    if (bDue) bDue.onclick = function () {
      var ids = StatLib.dueWrongIds();
      var list = ids.map(function (i) { return Bank.get(i); }).filter(Boolean);
      if (!list.length) return;
      Bank.shuffle(list);
      App.startSession(list, "错题复习 · " + list.length + "题");
    };
    $("#btnReviewAll").onclick = function () {
      var ids = Object.keys(Store.getWrong());
      var list = ids.map(function (i) { return Bank.get(i); }).filter(Boolean);
      if (!list.length) { UI.toast("错题本还是空的"); return; }
      Bank.shuffle(list);
      App.startSession(list, "错题全刷 · " + list.length + "题");
    };

    $$("#view-wrong [data-open]").forEach(function (b) {
      b.onclick = function () { openDetail(b.dataset.open); };
    });
    $$("#view-wrong [data-redo]").forEach(function (b) {
      b.onclick = function () { openDetail(b.dataset.redo, true); };
    });
    $$("#view-wrong [data-tag]").forEach(function (b) {
      b.onclick = function () { openTagEditor(b.dataset.tag); };
    });
    $$("#view-wrong [data-del]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.del;
        UI.confirmBox("确定把这道题移出错题本吗？（做题记录仍会保留）", function () {
          Store.removeWrong(id); UI.toast("已移除"); View.render(); App.refreshBadges();
        }, "移除");
      };
    });
    $$("#view-wrong .master i").forEach(function (i) {
      i.onclick = function () {
        var id = i.parentNode.dataset.master;
        var it = Store.getWrongItem(id);
        it.master = +i.dataset.mv;
        it.lastReviewAt = Date.now();
        Store.setWrongItem(id, it);
        View.render(); App.refreshBadges();
      };
    });
  }

  /* ---------------- 详情 / 二次作答 ---------------- */
  function openDetail(qid, redoMode) {
    var q = Bank.get(qid);
    if (!q) { UI.toast("题目数据缺失"); return; }
    var it = Store.getWrongItem(qid) || {};
    var progress = Store.getProgress()[qid] || {};
    var tags = Store.getTags();

    var html = "<h3>错题详情</h3>";
    html += '<div class="row" style="margin-bottom:10px">' +
      '<span class="q-tag">' + esc(q.module) + "</span><span class=\"q-tag gray\">" + esc(q.type) + (q.subtype ? " · " + esc(q.subtype) : "") + "</span>" +
      '<span class="mlevel l' + (it.master || 0) + '">' + MASTER_NAME[it.master || 0] + "</span>" +
      '<span class="hint">错 ' + (it.wrongCount || 0) + " 次 · 上次选择 " + (progress.lastChoice || "—") + "</span></div>";

    if (q.passage) html += '<div class="passage" style="max-height:200px">' + esc(q.passage) + "</div>";
    if (q.figure) html += '<div class="figure-box">' + q.figure + "</div>";

    html += '<div class="q-stem">' + esc(q.stem) + "</div>";
    html += '<div class="options" id="dtOpt">' + q.options.map(function (o, i) {
      var key = String.fromCharCode(65 + i);
      var cls = "opt";
      if (!redoMode) {
        cls += " disabled";
        if (key === q.answer) cls += " correct";
        else if (key === progress.lastChoice) cls += " wrong";
      }
      return '<div class="' + cls + '" data-dopt="' + key + '"><div class="key">' + key + '</div><div class="val">' + esc(o.replace(/^[A-D][．.、]\s*/, "")) + "</div></div>";
    }).join("") + "</div>";

    html += '<div id="dtResult"></div>';

    if (!redoMode) {
      html += '<div class="analysis"><div class="body">' + esc(q.analysis) + '</div><div class="ansline">正确答案：' + q.answer + "</div></div>";
    }

    // 标签
    html += '<div style="margin-top:14px"><div class="hint" style="margin-bottom:6px">标签（点击切换，可自定义）</div>' +
      '<div class="row" id="dtTags">' + tags.map(function (t) {
        return '<span class="chip tag' + ((it.tags || []).indexOf(t) >= 0 ? " active" : "") + '" data-dtag="' + esc(t) + '">' + esc(t) + "</span>";
      }).join("") + '<span class="chip" id="dtNewTag" style="border:1px dashed var(--line)">＋</span></div></div>';

    // 笔记
    html += '<div style="margin-top:12px"><div class="hint" style="margin-bottom:6px">错题笔记（错因、口诀、提醒自己的话）</div>' +
      '<textarea id="dtNote" placeholder="例如：注意题干问的是“不正确的是”；比重公式记反了…">' + esc(it.note || "") + "</textarea></div>";

    html += '<div class="modal-foot">' +
      '<button class="btn" id="dtClose">关闭</button>' +
      '<button class="btn" id="dtRedoBtn">重新作答</button>' +
      '<button class="btn" id="dtMaster">标为已掌握</button>' +
      '<button class="btn primary" id="dtSave">保存笔记</button>' +
      "</div>";

    UI.modal(html, { width: "720px" });

    var picked = null;
    $$("#dtOpt .opt").forEach(function (o) {
      if (o.classList.contains("disabled")) return;
      o.onclick = function () {
        picked = o.dataset.dopt;
        $$("#dtOpt .opt").forEach(function (x) { x.classList.remove("selected"); });
        o.classList.add("selected");
        $("#dtResult").innerHTML = '<div class="row"><button class="btn primary" id="dtSubmit">提交答案</button></div>';
        $("#dtSubmit").onclick = submitRedo;
      };
    });

    function submitRedo() {
      var correct = picked === q.answer;
      var now = Date.now();
      var w = Store.getWrongItem(qid) || { addedAt: now };
      w.rightCount = w.rightCount || 0; w.wrongCount = w.wrongCount || 0;
      if (correct) { w.rightCount++; w.master = Math.min(3, (w.master || 0) + 1); }
      else { w.wrongCount++; w.master = 0; w.lastWrongAt = now; }
      w.lastReviewAt = now;
      Store.setWrongItem(qid, w);

      var prog = Store.getProgress();
      var p = prog[qid] || { done: 0, correct: 0, wrong: 0 };
      p.done++; if (correct) p.correct++; else p.wrong++;
      p.lastAt = now; p.lastChoice = picked;
      prog[qid] = p; Store.set("progress", prog);
      Store.addRecord({ ts: now, qid: qid, module: q.module, type: q.type, correct: correct, duration: 0, choice: picked, redo: true });
      Store.addDaily(0, 1, correct ? 1 : 0);

      $$("#dtOpt .opt").forEach(function (x) {
        x.classList.add("disabled"); x.classList.remove("selected");
        var k = x.dataset.dopt;
        if (k === q.answer) x.classList.add("correct");
        else if (k === picked) x.classList.add("wrong");
      });
      $("#dtResult").innerHTML = '<div class="analysis"><h4>' +
        (correct ? '<span class="verdict ok">✓ 这次答对了！掌握度 +1</span>' : '<span class="verdict no">✗ 又错了，掌握度已归零</span>') +
        '</h4><div class="body">' + esc(q.analysis) + '</div><div class="ansline">正确答案：' + q.answer + "</div></div>";
      UI.toast(correct ? "答对啦，掌握度提升" : "别急，看解析再记一遍");
      App.refreshBadges();
    }

    $$("#dtTags .chip[data-dtag]").forEach(function (c) {
      c.onclick = function () {
        var w = Store.getWrongItem(qid) || {};
        w.tags = w.tags || [];
        var t = c.dataset.dtag, i = w.tags.indexOf(t);
        if (i >= 0) w.tags.splice(i, 1); else w.tags.push(t);
        Store.setWrongItem(qid, w);
        c.classList.toggle("active");
      };
    });
    $("#dtNewTag").onclick = function () {
      var v = prompt("输入新标签（12 字以内）");
      if (!v) return;
      v = v.trim().slice(0, 12);
      if (!v) return;
      Store.addTag(v);
      var w = Store.getWrongItem(qid) || {};
      w.tags = w.tags || [];
      if (w.tags.indexOf(v) < 0) w.tags.push(v);
      Store.setWrongItem(qid, w);
      openDetail(qid, false);
    };
    $("#dtSave").onclick = function () {
      var w = Store.getWrongItem(qid) || {};
      w.note = $("#dtNote").value;
      Store.setWrongItem(qid, w);
      UI.toast("笔记已保存");
      UI.closeModal();
      View.render();
    };
    $("#dtMaster").onclick = function () {
      var w = Store.getWrongItem(qid) || {};
      w.master = 3; w.lastReviewAt = Date.now(); w.note = ($("#dtNote") ? $("#dtNote").value : w.note);
      Store.setWrongItem(qid, w);
      UI.toast("已标记为掌握");
      UI.closeModal(); View.render(); App.refreshBadges();
    };
    $("#dtRedoBtn").onclick = function () { openDetail(qid, true); };
    $("#dtClose").onclick = function () { UI.closeModal(); View.render(); };

    if (redoMode) UI.toast("请选择答案后提交");
  }

  /* ---------------- 快速打标签 ---------------- */
  function openTagEditor(qid) {
    openDetail(qid, false);
    var el = UI.$("#dtTags");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
  }

  /* ---------------- 标签管理 ---------------- */
  function manageTags() {
    var tags = Store.getTags();
    var wrong = Store.getWrong();
    var usage = {};
    Object.keys(wrong).forEach(function (id) {
      (wrong[id].tags || []).forEach(function (t) { usage[t] = (usage[t] || 0) + 1; });
    });
    var isPreset = {};
    Store.defaultTags.forEach(function (t) { isPreset[t] = 1; });

    UI.modal('<h3>标签管理</h3>' +
      '<div class="hint" style="margin-bottom:10px">预设高频标签可删除、也可新增自己的。删除标签会同时从所有错题上摘掉。</div>' +
      '<div class="row">' + tags.map(function (t) {
        return '<span class="chip tag" style="padding-right:6px">' + esc(t) + "（" + (usage[t] || 0) + "）" +
          '<b class="x" data-tname="' + esc(t) + '" title="重命名">✎</b>' +
          '<b class="x" data-tdel="' + esc(t) + '" title="删除">✕</b></span>';
      }).join("") + "</div>" +
      '<div class="row" style="margin-top:16px"><input type="text" id="mtNew" placeholder="新增标签" maxlength="12"><button class="btn primary" id="mtAdd">添加</button></div>' +
      '<div class="modal-foot"><button class="btn" id="mtClose">关闭</button><button class="btn" id="mtRestore">恢复预设标签</button></div>',
      { width: "640px" });

    $$("#modalBox [data-tdel]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var t = b.dataset.tdel;
        UI.confirmBox("删除标签「" + esc(t) + "」？会同时从所有错题上移除。", function () {
          Store.removeTag(t); UI.toast("已删除"); manageTags(); View.render();
        }, "删除");
      };
    });
    $$("#modalBox [data-tname]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var v = prompt("重命名标签", b.dataset.tname);
        if (v && v.trim()) { Store.renameTag(b.dataset.tname, v.trim().slice(0, 12)); manageTags(); View.render(); }
      };
    });
    $("#mtAdd").onclick = function () {
      var v = $("#mtNew").value.trim();
      if (!v) return;
      if (Store.addTag(v)) { UI.toast("已添加"); manageTags(); View.render(); } else UI.toast("已存在");
    };
    $("#mtRestore").onclick = function () {
      Store.defaultTags.forEach(function (t) { Store.addTag(t); });
      manageTags(); View.render(); UI.toast("预设标签已恢复");
    };
    $("#mtClose").onclick = function () { UI.closeModal(); };
  }

  View.openDetail = openDetail;
  window.ViewWrong = View;
})();
