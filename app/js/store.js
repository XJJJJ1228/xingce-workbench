/* ============================================================
 * store.js —— 数据持久化层
 * 所有用户数据存 localStorage，键前缀 xc:
 * 更新题库 / 升级应用都不会清除，除非用户主动"清空数据"
 * ========================================================== */
(function () {
  "use strict";

  var PREFIX = "xc:";
  var VERSION = 1;

  // ---------- 底层读写 ----------
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[store] 读取失败", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("[store] 写入失败", key, e);
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        alert("本地存储空间已满，请在「设置」中导出备份后清理旧数据。");
      }
      return false;
    }
  }

  var Store = {
    version: VERSION,

    get: read,
    set: write,

    remove: function (key) {
      localStorage.removeItem(PREFIX + key);
    },

    keys: function () {
      var out = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
      }
      return out;
    },

    /* ---------------- 题目状态 ---------------- */
    // progress: { qid: { done, correct, wrong, lastAt, bestStreak } }
    getProgress: function () { return read("progress", {}); },
    getQuestionStat: function (qid) {
      return read("progress", {})[qid] || null;
    },

    /* ---------------- 答题流水 ---------------- */
    // records: [ { ts, qid, module, type, subtype, correct, duration, sessionId } ]
    getRecords: function () { return read("records", []); },
    addRecord: function (rec) {
      var list = read("records", []);
      list.push(rec);
      // 只保留最近 20000 条，防止爆空间
      if (list.length > 20000) list = list.slice(list.length - 20000);
      write("records", list);
    },

    /* ---------------- 会话 ---------------- */
    getSessions: function () { return read("sessions", []); },
    addSession: function (s) {
      var list = read("sessions", []);
      list.push(s);
      if (list.length > 2000) list = list.slice(list.length - 2000);
      write("sessions", list);
      return s;
    },

    /* ---------------- 错题本 ---------------- */
    // wrong: { qid: { qid, addedAt, wrongCount, rightCount, master(0-3), tags:[], note, lastWrongAt, lastReviewAt, due } }
    getWrong: function () { return read("wrong", {}); },
    getWrongItem: function (qid) { return read("wrong", {})[qid] || null; },
    setWrongItem: function (qid, item) {
      var w = read("wrong", {});
      w[qid] = item;
      write("wrong", w);
    },
    removeWrong: function (qid) {
      var w = read("wrong", {});
      delete w[qid];
      write("wrong", w);
    },

    /* ---------------- 标签 ---------------- */
    // 预设高频行测标签
    defaultTags: [
      "审题不清", "知识点盲区", "计算失误", "公式记错", "时间不够",
      "易混淆", "高频考点", "成语不熟", "逻辑绕", "图推规律没看出",
      "数据定位错", "粗心", "蒙对的", "经典好题", "反复错"
    ],
    getTags: function () {
      var t = read("tags", null);
      if (!t) { t = this.defaultTags.slice(); write("tags", t); }
      return t;
    },
    addTag: function (tag) {
      tag = (tag || "").trim();
      if (!tag) return false;
      var t = this.getTags();
      if (t.indexOf(tag) >= 0) return false;
      t.push(tag);
      write("tags", t);
      return true;
    },
    removeTag: function (tag) {
      var t = this.getTags().filter(function (x) { return x !== tag; });
      write("tags", t);
      // 同时从所有错题上摘掉
      var w = this.getWrong();
      Object.keys(w).forEach(function (k) {
        if (w[k].tags) w[k].tags = w[k].tags.filter(function (x) { return x !== tag; });
      });
      write("wrong", w);
    },
    renameTag: function (oldTag, newTag) {
      newTag = (newTag || "").trim();
      if (!newTag) return;
      var t = this.getTags();
      var i = t.indexOf(oldTag);
      if (i >= 0) { t[i] = newTag; write("tags", t); }
      var w = this.getWrong();
      Object.keys(w).forEach(function (k) {
        if (w[k].tags) w[k].tags = w[k].tags.map(function (x) { return x === oldTag ? newTag : x; });
      });
      write("wrong", w);
    },

    /* ---------------- 收藏 ---------------- */
    getFavs: function () { return read("favs", []); },
    isFav: function (qid) { return read("favs", []).indexOf(qid) >= 0; },
    toggleFav: function (qid) {
      var f = read("favs", []);
      var i = f.indexOf(qid);
      if (i >= 0) f.splice(i, 1); else f.push(qid);
      write("favs", f);
      return i < 0;
    },
    setFav: function (qid, on) {
      var f = read("favs", []);
      var i = f.indexOf(qid);
      if (on && i < 0) f.push(qid);
      if (!on && i >= 0) f.splice(i, 1);
      write("favs", f);
    },

    /* ---------------- 卡片进度 ---------------- */
    // cardProgress: { cid: { star, mastered, seen, lastAt, reviewCount } }
    getCardProgress: function () { return read("cardProgress", {}); },
    getCardStat: function (cid) { return read("cardProgress", {})[cid] || null; },
    setCardStat: function (cid, stat) {
      var c = read("cardProgress", {});
      c[cid] = stat;
      write("cardProgress", c);
    },

    /* ---------------- 自定义题库（用户导入） ---------------- */
    getCustomQuestions: function () { return read("customQuestions", []); },
    addCustomQuestions: function (list) {
      var cur = read("customQuestions", []);
      var exist = {};
      cur.forEach(function (q) { exist[q.id] = 1; });
      var added = 0;
      list.forEach(function (q) {
        if (!q.id) q.id = "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
        if (exist[q.id]) q.id = q.id + "-d" + (added + 1);
        q.custom = true;
        q.source = q.source || "用户导入";
        cur.push(q);
        exist[q.id] = 1;
        added++;
      });
      write("customQuestions", cur);
      return added;
    },
    removeCustomQuestion: function (id) {
      var cur = read("customQuestions", []).filter(function (q) { return q.id !== id; });
      write("customQuestions", cur);
    },
    clearCustomQuestions: function () { write("customQuestions", []); },

    /* ---------------- 学习时长 ---------------- */
    // dailyStat: { "2026-09-16": { ms, count, correct } }
    getDaily: function () { return read("daily", {}); },
    addDaily: function (ms, count, correct) {
      var d = read("daily", {});
      var k = todayKey();
      if (!d[k]) d[k] = { ms: 0, count: 0, correct: 0 };
      d[k].ms += ms;
      d[k].count += count;
      d[k].correct += correct;
      write("daily", d);
    },

    /* ---------------- 设置 ---------------- */
    defaultSettings: {
      questionCount: 20,      // 单次刷题题量
      showAnalysisNow: false, // 是否答完立即看解析
      shuffleOptions: false,
      dailyGoal: 30,
      reviewPerDay: 20,
      cardPerDay: 20,
      autoAddWrong: true,     // 答错自动进错题本
      timerVisible: true
    },
    getSettings: function () {
      var s = read("settings", {});
      var out = {};
      var d = this.defaultSettings;
      for (var k in d) if (d.hasOwnProperty(k)) out[k] = (s[k] === undefined ? d[k] : s[k]);
      return out;
    },
    setSettings: function (s) {
      var cur = this.getSettings();
      for (var k in s) if (s.hasOwnProperty(k)) cur[k] = s[k];
      write("settings", cur);
    },

    /* ---------------- 备份 / 恢复 / 清空 ---------------- */
    exportAll: function () {
      var data = { _app: "行测工作台", _version: VERSION, _at: new Date().toISOString() };
      this.keys().forEach(function (k) { data[k] = read(k, null); });
      return data;
    },
    importAll: function (data, merge) {
      if (!data || typeof data !== "object") throw new Error("文件格式不正确");
      var self = this;
      Object.keys(data).forEach(function (k) {
        if (k.indexOf("_") === 0) return;
        var v = data[k];
        if (merge && (k === "records" || k === "sessions" || k === "favs" || k === "customQuestions") && Array.isArray(v)) {
          var cur = read(k, []);
          var seen = {};
          if (k === "records") cur.forEach(function (r) { seen[r.ts + "|" + r.qid] = 1; });
          else if (k === "customQuestions") cur.forEach(function (r) { seen[r.id] = 1; });
          else cur.forEach(function (r) { seen[r] = 1; });
          v.forEach(function (r) {
            var key = (k === "records") ? (r.ts + "|" + r.qid) : (k === "customQuestions" ? r.id : r);
            if (!seen[key]) { cur.push(r); seen[key] = 1; }
          });
          write(k, cur);
        } else if (merge && (k === "progress" || k === "wrong" || k === "cardProgress" || k === "daily") && v && typeof v === "object") {
          var c = read(k, {});
          Object.keys(v).forEach(function (kk) {
            if (c[kk] === undefined) c[kk] = v[kk];
            else if (k === "daily" && c[kk].ms !== undefined) {
              c[kk].ms += v[kk].ms || 0; c[kk].count += v[kk].count || 0; c[kk].correct += v[kk].correct || 0;
            }
          });
          write(k, c);
        } else {
          write(k, v);
        }
      });
    },
    clearAll: function () {
      this.keys().forEach(function (k) { localStorage.removeItem(PREFIX + k); });
    },
    clearPracticeData: function () {
      ["progress", "records", "sessions", "wrong", "daily"].forEach(function (k) {
        localStorage.removeItem(PREFIX + k);
      });
    },

    usage: function () {
      var n = 0;
      this.keys().forEach(function (k) {
        var v = localStorage.getItem(PREFIX + k);
        if (v) n += v.length;
      });
      return n; // 字符数（近似字节）
    }
  };

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  Store.todayKey = todayKey;
  Store.pad = pad;

  window.Store = Store;
})();
