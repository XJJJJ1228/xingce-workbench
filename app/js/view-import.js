/* ============================================================
 * 导入 / 备份 —— 支持 json / csv / txt / md 题目文件
 * ========================================================== */
(function () {
  "use strict";
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  /* ---------------- 解析器 ---------------- */
  var Parser = {
    parse: function (text, filename) {
      text = (text || "").trim();
      if (!text) return [];
      var ext = (filename || "").split(".").pop().toLowerCase();
      if (ext === "json" || /^[\s\r\n]*[\[{]/.test(text)) {
        try {
          var data = JSON.parse(text);
          var arr = Array.isArray(data) ? data : (data.questions || data.data || data.list || [data]);
          return arr.map(function (q) { return Parser.norm(q); }).filter(function (q) { return q.stem && q.options.length; });
        } catch (e) {
          // JSON 解析失败，退回文本解析
        }
      }
      if (ext === "csv") return Parser.parseCSV(text);
      return Parser.parseBlocks(text);
    },

    norm: function (q) {
      var out = {
        id: q.id || "",
        module: q.module || q.模块 || q.category || "",
        type: q.type || q.题型 || "",
        subtype: q.subtype || q.小题型 || "",
        difficulty: q.difficulty || 2,
        stem: q.stem || q.题干 || q.question || q.title || "",
        options: q.options || [q.A, q.B, q.C, q.D].filter(Boolean),
        answer: (q.answer || q.答案 || "").toString().trim().toUpperCase().replace(/[^A-D]/g, ""),
        analysis: q.analysis || q.解析 || q.explanation || "",
        tags: Parser.toArr(q.tags || q.标签),
        passage: q.passage || q.材料 || "",
        groupId: q.groupId || "",
        figure: q.figure || "",
        source: q.source || "用户导入"
      };
      if (!Array.isArray(out.options)) out.options = [];
      // 选项规范化
      out.options = out.options.map(function (o, i) {
        var s = String(o).trim();
        return /^[A-D][．.、:：]/.test(s) ? s : String.fromCharCode(65 + i) + "．" + s;
      });
      if (!out.module) out.module = guessModule(out);
      if (!out.type) out.type = guessType(out.module);
      return out;
    },

    toArr: function (v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      return String(v).split(/[,，、;；]/).map(function (s) { return s.trim(); }).filter(Boolean);
    },

    // 简单 CSV（支持引号）
    parseCSV: function (text) {
      var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (lines.length < 2) return [];
      var head = Parser.csvRow(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
      var map = {
        "题干": "stem", "题目": "stem", "stem": "stem", "question": "stem", "title": "stem",
        "模块": "module", "module": "module", "类别": "module",
        "题型": "type", "type": "type",
        "小题型": "subtype", "subtype": "subtype",
        "选项a": "A", "a": "A", "选项b": "B", "b": "B", "选项c": "C", "c": "C", "选项d": "D", "d": "D",
        "答案": "answer", "answer": "answer",
        "解析": "analysis", "analysis": "analysis", "explanation": "analysis",
        "标签": "tags", "tags": "tags",
        "材料": "passage", "passage": "passage"
      };
      var out = [];
      for (var i = 1; i < lines.length; i++) {
        var cells = Parser.csvRow(lines[i]);
        var obj = {};
        head.forEach(function (h, j) {
          var key = map[h] || h;
          obj[key] = cells[j];
        });
        var q = Parser.norm(obj);
        if (q.stem && q.options.length) out.push(q);
      }
      return out;
    },

    csvRow: function (line) {
      var out = [], cur = "", inQ = false;
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if ((c === "," || c === "\t") && !inQ) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur);
      return out;
    },

    // 自由文本：按空行分块
    parseBlocks: function (text) {
      var blocks = text.split(/\n\s*\n+/);
      var out = [];
      var lastPassage = "";
      blocks.forEach(function (b) {
        var lines = b.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        if (!lines.length) return;
        var stemLines = [], options = [], answer = "", analysisLines = [], module = "", type = "", tags = [], inAnalysis = false;
        lines.forEach(function (ln) {
          var m;
          if ((m = ln.match(/^(?:答案|正确答案|【答案】)\s*[:：]?\s*([A-Da-d])/))) { answer = m[1].toUpperCase(); inAnalysis = false; return; }
          if ((m = ln.match(/^(?:解析|【解析】|解析[:：])\s*(.*)$/))) { inAnalysis = true; if (m[1]) analysisLines.push(m[1]); return; }
          if (inAnalysis) { analysisLines.push(ln); return; }
          if ((m = ln.match(/^(?:模块|科目)\s*[:：]\s*(.+)$/))) { module = m[1].trim(); return; }
          if ((m = ln.match(/^(?:题型)\s*[:：]\s*(.+)$/))) { type = m[1].trim(); return; }
          if ((m = ln.match(/^(?:标签|知识点)\s*[:：]\s*(.+)$/))) { tags = Parser.toArr(m[1]); return; }
          if ((m = ln.match(/^\s*([A-D])[．.、:：)\s]\s*(.+)$/))) { options[m[1].toUpperCase()] = m[1].toUpperCase() + "．" + m[2].trim(); return; }
          if (/^(?:材料|材料一|材料二|根据以下)/.test(ln) || /\|/.test(ln)) { lastPassage += (lastPassage ? "\n" : "") + ln; return; }
          stemLines.push(ln);
        });
        var opts = ["A", "B", "C", "D"].map(function (k) { return options[k]; }).filter(Boolean);
        var stem = stemLines.join("\n");
        if (stem && opts.length >= 2) {
          out.push(Parser.norm({
            stem: stem, options: opts, answer: answer || "A",
            analysis: analysisLines.join("\n"), module: module, type: type, tags: tags,
            passage: lastPassage, source: "用户导入"
          }));
        }
      });
      return out;
    }
  };

  function guessModule(q) {
    var t = (q.stem + (q.analysis || "")).toLowerCase();
    if (/增长率|比重|同比|环比|亿元|万人|百分点|统计图|表格/.test(q.stem)) return "资料分析";
    if (/填入画横线|依次填入|最恰当|成语|词语|排序|主旨|意在说明|概括/.test(q.stem)) return "言语理解";
    if (/图形|问号处|定义|下列属于|类比|削弱|加强|推出|前提/.test(q.stem)) return "判断推理";
    if (/\d/.test(q.stem) && /多少|求|速度|效率|概率|成本|面积/.test(q.stem)) return "数量关系";
    return "常识判断";
  }
  function guessType(mod) {
    return (Bank.TYPES[mod] || ["综合"])[0];
  }

  /* ---------------- 视图 ---------------- */
  var pending = [];

  var View = {};

  View.render = function () {
    var custom = Store.getCustomQuestions();
    var html = "";

    html += '<div class="grid g2 sec">';

    // 文件导入
    html += '<div class="card card-pad"><div class="sec-title">① 导入题目文件</div>' +
      '<div class="hint" style="margin-bottom:10px">支持 <b>.json / .csv / .txt / .md</b>。导入的题会合并进题库，并自动打上「用户导入」标记，原有学习数据不受影响。</div>' +
      '<div style="border:2px dashed var(--line);border-radius:12px;padding:22px;text-align:center;cursor:pointer" id="dropZone">' +
      '<div style="font-size:28px">📥</div><div style="font-size:13px;color:var(--text-2)">点击选择文件，或把文件拖到这里</div>' +
      '<div class="hint">也可以直接粘贴题目文本（见下方）</div></div>' +
      '<input type="file" id="fileInput" accept=".json,.csv,.txt,.md,.jsonl" style="display:none">' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="btnTplJson">下载 JSON 模板</button>' +
      '<button class="btn" id="btnTplCsv">下载 CSV 模板</button>' +
      '<button class="btn" id="btnTplTxt">下载 TXT 模板</button></div>' +
      "</div>";

    // 备份
    html += '<div class="card card-pad"><div class="sec-title">② 数据备份 / 恢复</div>' +
      '<div class="hint" style="margin-bottom:10px">所有学习数据（做题记录、错题、标签、收藏、卡片进度）都保存在本机浏览器里。建议每周导出一次备份。</div>' +
      '<div class="row"><button class="btn primary" id="btnBackup">导出完整备份</button>' +
      '<button class="btn" id="btnRestore">从备份恢复</button>' +
      '<input type="file" id="backupInput" accept=".json" style="display:none"></div>' +
      '<div class="hint" style="margin-top:10px">当前占用存储：约 ' + (Store.usage() / 1024).toFixed(1) + " KB</div>" +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)">' +
      '<div class="hint" style="margin-bottom:6px">把自定义题库导出成 JS 文件，放进 <code>app/data/bank-custom.js</code> 即可永久固化到应用里：</div>' +
      '<button class="btn" id="btnExportJs">导出自定义题库 JS</button></div>' +
      "</div>";

    html += "</div>";

    // 粘贴文本
    html += '<div class="card card-pad sec"><div class="sec-title">③ 粘贴题目文本快速导入</div>' +
      '<div class="hint" style="margin-bottom:8px">格式要求宽松，只要包含题干、A/B/C/D 选项、答案即可，解析可选。示例：</div>' +
      '<pre style="background:#fafbff;border:1px solid var(--line);border-radius:8px;padding:10px;font-size:12px;color:var(--text-2);overflow:auto">' +
      "依次填入下列横线处的词语，最恰当的一组是：______\nA．遏制\nB．遏止\nC．制止\nD．禁止\n答案：A\n解析：【解析】“遏制”侧重控制，“遏止”侧重使停止……故正确答案为A。" +
      "</pre>" +
      '<textarea id="pasteArea" placeholder="把题目粘贴到这里…" style="min-height:130px"></textarea>' +
      '<div class="row row-end" style="margin-top:10px"><button class="btn" id="btnClearPaste">清空</button><button class="btn primary" id="btnParsePaste">解析并预览</button></div>' +
      "</div>";

    // 自定义题库
    html += '<div class="card card-pad sec"><div class="sec-title">已导入题目 <span class="sub">共 ' + custom.length + " 题（保存在本机，可通过上方导出 JS 永久固化）</span></div>";
    if (!custom.length) html += '<div class="empty"><div class="big">📚</div>还没有导入过题目</div>';
    else {
      html += '<table class="tbl"><thead><tr><th>模块 / 题型</th><th>题干</th><th>答案</th><th>操作</th></tr></thead><tbody>' +
        custom.map(function (q) {
          return "<tr><td>" + esc(q.module) + " · " + esc(q.type) + '</td><td class="stem-clamp" style="max-width:420px">' + esc(q.stem.slice(0, 60)) + "</td><td>" + esc(q.answer) + "</td>" +
            '<td><button class="btn sm" data-cview="' + esc(q.id) + '">查看</button> <button class="btn sm danger" data-cdel="' + esc(q.id) + '">删除</button></td></tr>';
        }).join("") + "</tbody></table>";
      html += '<div class="row row-end" style="margin-top:10px"><button class="btn danger" id="btnClearCustom">清空全部导入题</button></div>';
    }
    html += "</div>";

    html += '<div class="card card-pad sec"><div class="sec-title">💡 让 AI 帮你整理</div>' +
      '<div style="font-size:13.5px;line-height:2;color:var(--text-2)">' +
      "把题目文件（Word / PDF / 图片转文字 / 网页复制的文本）直接发给 AI 助手，告诉它「整理进行测 app」，它会自动：<br>" +
      "① 按五大模块和小题型归类 → ② 格式化为题库文件写入 <code>app/data/bank-custom.js</code> → ③ 错题自动进错题本、知识点自动进积累专区 → ④ 刷新 app 即可看到新内容，历史学习数据不会丢失。" +
      "</div></div>";

    $("#view-import").innerHTML = html;
    bind(custom);
  };

  function bind(custom) {
    var zone = $("#dropZone"), fi = $("#fileInput");
    zone.onclick = function () { fi.click(); };
    zone.ondragover = function (e) { e.preventDefault(); zone.style.borderColor = "var(--primary)"; };
    zone.ondragleave = function () { zone.style.borderColor = ""; };
    zone.ondrop = function (e) {
      e.preventDefault(); zone.style.borderColor = "";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
    };
    fi.onchange = function () { if (fi.files[0]) readFile(fi.files[0]); fi.value = ""; };

    $("#btnTplJson").onclick = function () {
      UI.download("行测导入模板.json", JSON.stringify([
        {
          module: "言语理解", type: "逻辑填空", subtype: "成语辨析", difficulty: 2,
          stem: "依次填入画横线部分最恰当的一项是：______",
          options: ["A．南辕北辙", "B．背道而驰", "C．大相径庭", "D．泾渭分明"],
          answer: "A",
          analysis: "【解析】“南辕北辙”比喻行动和目的相反……故正确答案为A。",
          tags: ["成语辨析"], source: "用户导入"
        }
      ], null, 2));
    };
    $("#btnTplCsv").onclick = function () {
      UI.download("行测导入模板.csv",
        "模块,题型,题干,选项A,选项B,选项C,选项D,答案,解析,标签\n" +
        "数量关系,数学运算,一项工程甲单独做需要10天，乙单独做需要15天，两人合作需要多少天？,4天,5天,6天,7天,C,【解析】设工程总量为30，甲效率3，乙效率2，合作效率5，30÷5=6天。故正确答案为C。,工程问题",
        "text/csv");
    };
    $("#btnTplTxt").onclick = function () {
      UI.download("行测导入模板.txt",
        "模块：常识判断\n题型：政治常识\n我国的最高国家权力机关是：______\nA．国务院\nB．全国人民代表大会\nC．中央政治局\nD．最高人民法院\n答案：B\n解析：【解析】宪法规定，全国人民代表大会是最高国家权力机关。故正确答案为B。\n\n" +
        "依次填入划横线部分最恰当的一项是：______\nA．遏制\nB．遏止\nC．制止\nD．禁止\n答案：A\n解析：【解析】“遏制”侧重控制住，“遏止”侧重使停止。故正确答案为A。\n",
        "text/plain");
    };

    $("#btnParsePaste").onclick = function () {
      var t = $("#pasteArea").value;
      if (!t.trim()) { UI.toast("请先粘贴题目"); return; }
      var list = Parser.parse(t, "paste.txt");
      preview(list, "粘贴文本");
    };
    $("#btnClearPaste").onclick = function () { $("#pasteArea").value = ""; };

    $("#btnBackup").onclick = function () {
      var d = Store.exportAll();
      UI.download("行测工作台备份-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(d, null, 2));
      UI.toast("备份已下载");
    };
    var bi = $("#backupInput");
    $("#btnRestore").onclick = function () { bi.click(); };
    bi.onchange = function () {
      if (!bi.files[0]) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var data = JSON.parse(r.result);
          UI.confirmBox("检测到备份文件（" + (data._at || "").slice(0, 10) + "）。<br>选择「确定」= 与当前数据合并（推荐）；<br>需要完全覆盖请在设置里先清空数据。",
            function () { Store.importAll(data, true); Bank.reload(); UI.toast("已合并恢复"); App.refreshBadges(); View.render(); }, "合并恢复");
        } catch (e) { UI.toast("备份文件解析失败：" + e.message); }
      };
      r.readAsText(bi.files[0], "utf-8");
      bi.value = "";
    };

    $("#btnExportJs").onclick = function () {
      var list = Store.getCustomQuestions();
      if (!list.length) { UI.toast("还没有导入过题目"); return; }
      var txt = "window.BANK_DATA = window.BANK_DATA || [];\nwindow.BANK_DATA.push(\n" +
        list.map(function (q) { return "  " + JSON.stringify(q); }).join(",\n") + "\n);\n";
      UI.download("bank-custom.js", txt, "text/javascript");
      UI.toast("已导出，放到 app/data/ 目录即可永久生效");
    };

    $$("#view-import [data-cview]").forEach(function (b) {
      b.onclick = function () {
        var q = Store.getCustomQuestions().filter(function (x) { return x.id === b.dataset.cview; })[0];
        if (!q) return;
        UI.modal("<h3>导入题目</h3>" +
          '<div class="row" style="margin-bottom:8px"><span class="q-tag">' + esc(q.module) + '</span><span class="q-tag gray">' + esc(q.type) + "</span></div>" +
          '<div class="q-stem">' + esc(q.stem) + "</div>" +
          '<div class="options">' + q.options.map(function (o, i) {
            var k = String.fromCharCode(65 + i);
            return '<div class="opt disabled' + (k === q.answer ? " correct" : "") + '"><div class="key">' + k + '</div><div class="val">' + esc(o) + "</div></div>";
          }).join("") + "</div>" +
          '<div class="analysis"><div class="body">' + esc(q.analysis || "（无解析）") + "</div></div>" +
          '<div class="modal-foot"><button class="btn primary" id="cvClose">关闭</button></div>', { width: "700px" });
        $("#cvClose").onclick = UI.closeModal;
      };
    });
    $$("#view-import [data-cdel]").forEach(function (b) {
      b.onclick = function () {
        UI.confirmBox("删除这道导入的题？", function () {
          Store.removeCustomQuestion(b.dataset.cdel); Bank.reload(); View.render(); UI.toast("已删除");
        }, "删除");
      };
    });
    var bc = $("#btnClearCustom");
    if (bc) bc.onclick = function () {
      UI.confirmBox("清空全部 " + custom.length + " 道导入题？（学习记录中的这些题仍会保留）", function () {
        Store.clearCustomQuestions(); Bank.reload(); View.render(); UI.toast("已清空");
      }, "清空");
    };
  }

  function readFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var list = Parser.parse(r.result, file.name);
      preview(list, file.name);
    };
    r.readAsText(file, "utf-8");
  }

  function preview(list, name) {
    if (!list.length) { UI.toast("没有识别出题目，请检查格式"); return; }
    pending = list;
    var byMod = {};
    list.forEach(function (q) { byMod[q.module] = (byMod[q.module] || 0) + 1; });
    var html = "<h3>导入预览</h3>" +
      '<div class="hint" style="margin-bottom:10px">来源：' + esc(name) + " · 识别到 <b>" + list.length + "</b> 道题 · " +
      Object.keys(byMod).map(function (m) { return m + " " + byMod[m]; }).join(" · ") + "</div>" +
      '<div style="max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:10px">' +
      list.slice(0, 8).map(function (q, i) {
        return '<div style="padding:8px 0;border-bottom:1px dashed var(--line)">' +
          '<div class="row" style="margin-bottom:4px"><span class="q-tag">' + esc(q.module) + '</span><span class="q-tag gray">' + esc(q.type) + "</span>" +
          '<span class="hint">答案 ' + esc(q.answer) + "</span></div>" +
          '<div style="font-size:13px">' + esc(q.stem.slice(0, 90)) + (q.stem.length > 90 ? "…" : "") + "</div>" +
          '<div class="hint" style="margin-top:3px">' + q.options.map(function (o) { return esc(o.slice(0, 24)); }).join(" ｜ ") + "</div>" +
          "</div>";
      }).join("") +
      (list.length > 8 ? '<div class="hint" style="padding-top:8px">… 其余 ' + (list.length - 8) + " 题略</div>" : "") +
      "</div>" +
      '<div class="row" style="margin-top:12px"><label class="field" style="flex:1">统一指定模块（可选）' +
      '<select id="pvModule"><option value="">按文件原样</option>' + Bank.MODULES.map(function (m) { return "<option>" + m + "</option>"; }).join("") + "</select></label>" +
      '<label class="field" style="flex:1">统一指定题型（可选）<select id="pvType"><option value="">按文件原样</option>' +
      Bank.MODULES.reduce(function (a, m) { return a.concat(Bank.TYPES[m]); }, []).filter(function (t, i, a) { return a.indexOf(t) === i; })
        .map(function (t) { return "<option>" + t + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="modal-foot"><button class="btn" id="pvCancel">取消</button><button class="btn primary" id="pvOk">确认导入 ' + list.length + " 题</button></div>";
    UI.modal(html, { width: "720px" });
    $("#pvCancel").onclick = function () { UI.closeModal(); };
    $("#pvOk").onclick = function () {
      var m = $("#pvModule").value, t = $("#pvType").value;
      var arr = pending.map(function (q, i) {
        var c = JSON.parse(JSON.stringify(q));
        if (m) c.module = m;
        if (t) c.type = t;
        if (!c.id) c.id = "custom-" + Date.now().toString(36) + "-" + i;
        return c;
      });
      var n = Store.addCustomQuestions(arr);
      Bank.reload();
      Store.set("importedAt", Date.now());
      UI.closeModal();
      UI.toast("成功导入 " + n + " 题，题库现有 " + Bank.count() + " 题");
      View.render();
      App.refreshBadges();
    };
  }

  View.parser = Parser;
  window.ViewImport = View;
})();
