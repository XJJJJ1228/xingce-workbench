/* ============================================================
 * ui.js —— 通用 UI 工具（DOM / Toast / Modal / 图表）
 * ========================================================== */
(function () {
  "use strict";

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 2000);
  }

  function modal(html, opts) {
    opts = opts || {};
    var mask = $("#modalMask"), box = $("#modalBox");
    box.innerHTML = html;
    mask.classList.add("show");
    box.style.position = "relative";
    if (opts.width) box.style.maxWidth = opts.width;
    else box.style.maxWidth = "760px";
    mask.onclick = function (e) { if (e.target === mask) closeModal(); };
    return box;
  }
  function closeModal() { $("#modalMask").classList.remove("show"); $("#modalBox").innerHTML = ""; }

  function confirmBox(msg, onYes, yesText) {
    modal(
      '<h3>确认操作</h3><div style="font-size:13.5px;line-height:1.9;color:var(--text-2)">' + msg + "</div>" +
      '<div class="modal-foot"><button class="btn" id="cfNo">取消</button>' +
      '<button class="btn ' + (yesText ? "danger" : "primary") + '" id="cfYes">' + (yesText || "确定") + "</button></div>",
      { width: "420px" }
    );
    $("#cfNo").onclick = closeModal;
    $("#cfYes").onclick = function () { closeModal(); onYes && onYes(); };
  }

  /* ---------- 时间格式 ---------- */
  function fmtDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    var s = Math.round(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + " 小时 " + m + " 分";
    if (m > 0) return m + " 分 " + ss + " 秒";
    return ss + " 秒";
  }
  function fmtShort(ms) {
    var s = Math.round(ms / 1000);
    var m = Math.floor(s / 60);
    if (m >= 60) return Math.floor(m / 60) + "h" + (m % 60) + "m";
    if (m > 0) return m + "m" + (s % 60) + "s";
    return s + "s";
  }
  function fmtClock(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    return (m < 10 ? "0" + m : m) + ":" + ((s % 60) < 10 ? "0" + (s % 60) : (s % 60));
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }
  function p2(n) { return n < 10 ? "0" + n : "" + n; }
  function daysAgo(ts) {
    var d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return "今天";
    if (d === 1) return "昨天";
    if (d < 30) return d + " 天前";
    return Math.floor(d / 30) + " 个月前";
  }
  function percent(a, b) {
    if (!b) return 0;
    return Math.round(a / b * 1000) / 10;
  }

  /* ---------- Canvas 图表 ---------- */
  function setupCanvas(cv, w, h) {
    var dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  // 柱状图
  function barChart(cv, labels, values, opt) {
    opt = opt || {};
    var w = cv.parentNode.clientWidth || 700, h = opt.height || 180;
    var ctx = setupCanvas(cv, w, h);
    var padL = 34, padR = 10, padT = 12, padB = 26;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = Math.max.apply(null, values.concat([opt.min || 1]));
    max = Math.ceil(max * 1.15) || 1;
    // 网格
    ctx.strokeStyle = "#eeeef5"; ctx.lineWidth = 1;
    ctx.fillStyle = "#9aa0b5"; ctx.font = "11px sans-serif"; ctx.textAlign = "right";
    for (var g = 0; g <= 4; g++) {
      var y = padT + ih - ih * g / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(Math.round(max * g / 4), padL - 6, y + 4);
    }
    var bw = iw / values.length * 0.56;
    values.forEach(function (v, i) {
      var x = padL + iw / values.length * (i + 0.5) - bw / 2;
      var bh = ih * (v / max);
      var grad = ctx.createLinearGradient(0, padT + ih - bh, 0, padT + ih);
      grad.addColorStop(0, opt.color || "#6366f1");
      grad.addColorStop(1, opt.color2 || "#c7c9f7");
      ctx.fillStyle = grad;
      rrect(ctx, x, padT + ih - bh, bw, Math.max(bh, v > 0 ? 2 : 0), 4);
      ctx.fill();
      if (v > 0) { ctx.fillStyle = "#5a6178"; ctx.textAlign = "center"; ctx.font = "10.5px sans-serif"; ctx.fillText(v, x + bw / 2, padT + ih - bh - 4); }
      ctx.fillStyle = "#9aa0b5"; ctx.textAlign = "center"; ctx.font = "10.5px sans-serif";
      ctx.fillText(labels[i], padL + iw / values.length * (i + 0.5), h - 8);
    });
  }

  // 折线图
  function lineChart(cv, labels, values, opt) {
    opt = opt || {};
    var w = cv.parentNode.clientWidth || 700, h = opt.height || 200;
    var ctx = setupCanvas(cv, w, h);
    var padL = 36, padR = 12, padT = 14, padB = 26;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = opt.max || 100, min = opt.min || 0;
    ctx.strokeStyle = "#eeeef5"; ctx.fillStyle = "#9aa0b5"; ctx.font = "11px sans-serif"; ctx.textAlign = "right";
    for (var g = 0; g <= 4; g++) {
      var y = padT + ih - ih * g / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(Math.round(min + (max - min) * g / 4) + (opt.suffix || ""), padL - 5, y + 4);
    }
    var pts = values.map(function (v, i) {
      return [padL + (values.length > 1 ? iw * i / (values.length - 1) : iw / 2), padT + ih - ih * ((v - min) / (max - min))];
    });
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.strokeStyle = opt.color || "#4f46e5"; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.stroke();
    // 面积
    ctx.lineTo(pts[pts.length - 1][0], padT + ih); ctx.lineTo(pts[0][0], padT + ih); ctx.closePath();
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
    grad.addColorStop(0, "rgba(79,70,229,.18)"); grad.addColorStop(1, "rgba(79,70,229,0)");
    ctx.fillStyle = grad; ctx.fill();
    pts.forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = opt.color || "#4f46e5"; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.fillStyle = "#9aa0b5"; ctx.textAlign = "center"; ctx.font = "10.5px sans-serif";
    labels.forEach(function (l, i) { ctx.fillText(l, padL + (values.length > 1 ? iw * i / (values.length - 1) : iw / 2), h - 8); });
  }

  // 雷达图
  function radarChart(cv, labels, values, opt) {
    opt = opt || {};
    var size = Math.min(cv.parentNode.clientWidth || 300, opt.size || 300);
    var ctx = setupCanvas(cv, size, size);
    var cx = size / 2, cy = size / 2 + 4, R = size / 2 - 42;
    var n = labels.length;
    ctx.strokeStyle = "#e9ebf4"; ctx.lineWidth = 1;
    for (var r = 1; r <= 4; r++) {
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + Math.PI * 2 * i / n;
        var x = cx + R * r / 4 * Math.cos(a), y = cy + R * r / 4 * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.beginPath();
    values.forEach(function (v, i) {
      var a = -Math.PI / 2 + Math.PI * 2 * i / n;
      var rr = R * Math.max(0.04, v / 100);
      var x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(79,70,229,.20)"; ctx.fill();
    ctx.strokeStyle = "#4f46e5"; ctx.lineWidth = 2; ctx.stroke();
    values.forEach(function (v, i) {
      var a = -Math.PI / 2 + Math.PI * 2 * i / n;
      var rr = R * Math.max(0.04, v / 100);
      ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3, 0, Math.PI * 2);
      ctx.fillStyle = "#4f46e5"; ctx.fill();
    });
    ctx.fillStyle = "#5a6178"; ctx.font = "11.5px sans-serif";
    labels.forEach(function (l, i) {
      var a = -Math.PI / 2 + Math.PI * 2 * i / n;
      var x = cx + (R + 20) * Math.cos(a), y = cy + (R + 20) * Math.sin(a);
      ctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? "center" : (Math.cos(a) > 0 ? "left" : "right");
      ctx.textBaseline = "middle";
      ctx.fillText(l, x, y);
    });
  }

  // 环形图
  function donutChart(cv, parts, opt) {
    opt = opt || {};
    var size = opt.size || 168;
    var ctx = setupCanvas(cv, size, size);
    var cx = size / 2, cy = size / 2, R = size / 2 - 8, r = R * 0.62;
    var total = parts.reduce(function (s, p) { return s + p.value; }, 0) || 1;
    var start = -Math.PI / 2;
    parts.forEach(function (p) {
      var ang = Math.PI * 2 * p.value / total;
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, start + ang);
      ctx.arc(cx, cy, r, start + ang, start, true);
      ctx.closePath();
      ctx.fillStyle = p.color; ctx.fill();
      start += ang;
    });
    if (opt.centerText) {
      ctx.fillStyle = "#1f2333"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 22px sans-serif";
      ctx.fillText(opt.centerText, cx, cy - 6);
      ctx.font = "11px sans-serif"; ctx.fillStyle = "#8b90a3";
      ctx.fillText(opt.centerSub || "", cx, cy + 14);
    }
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "application/json") + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function copyText(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("已复制到剪贴板"); });
    else toast("复制失败，请手动选择");
  }

  window.UI = {
    $: $, $$: $$, esc: esc, toast: toast, modal: modal, closeModal: closeModal, confirmBox: confirmBox,
    fmtDuration: fmtDuration, fmtShort: fmtShort, fmtClock: fmtClock, fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    daysAgo: daysAgo, percent: percent,
    barChart: barChart, lineChart: lineChart, radarChart: radarChart, donutChart: donutChart,
    download: download, copyText: copyText
  };
})();
