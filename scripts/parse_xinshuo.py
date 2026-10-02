#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_xinshuo.py —— 解析「欣说言语刷题集」排版（PDF 抽取后的 .txt）为结构化题目。

排版特征：
  - 每套题以套题名开头（如「2024联考A言语理解与表达」），名字里允许有空格/括号
  - 题干以「数字．」或「数字.」起头，选项为 A．B．C．D．
  - 答案集中在末尾「1-5. BADBB」这类区间格式，按题号精确映射（个别题被吞不整体错位）

用法：
  python scripts/parse_xinshuo.py --src inbox/pdf_text/xinshuo_up.txt --out inbox/parsed/xinshuo_up.json
  python scripts/parse_xinshuo.py --batch        # 自动处理 inbox/pdf_text 下的 xinshuo_up/down.txt

依赖：仅标准库
"""
import re, json, os, sys, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC_DIR = os.path.join(ROOT, "inbox", "pdf_text")
DEFAULT_OUT_DIR = os.path.join(ROOT, "inbox", "parsed")


def normalize_name(s):
    s = re.sub(r"\s+", "", s)
    s = s.replace("言语理解与表达", "")
    return s.strip()


# 容忍任意位置的空格：数字与地名、地名内部、套题名都允许出现 \s*；国考名可能带（地市级）等括号
NAME_RE = re.compile(
    r"^\s*\d{4}\s*(?:联\s*考|山\s*东|浙\s*江|江\s*苏|国\s*考|广\s*东\s*县\s*级)\s*"
    r"[ABC]?\s*言\s*语\s*理\s*解\s*与\s*表\s*达\s*(?:（[^）]*）)?\s*$"
)
QSTART = re.compile(r"(?m)^(?=\s*\d+[．.]\s*)")
OPT_RE = re.compile(r"([ABCD])\s*[．.]\s*([\s\S]*?)(?=\s*[ABCD]\s*[．.]|$)")
YEAR_MAP = {"联考A": "联考A", "联考B": "联考B", "山东": "山东", "浙江A": "浙江A"}


def clean_lines(lines):
    out = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if re.search(r"欣说言语|葛欣的一言一语|用心帮助每一个认真的你", s):
            continue
        if re.search(r"公众号|新浪微博|内部交流讲义|视频讲解|二维码", s):
            continue
        if re.fullmatch(r"\d{1,3}", s):  # 页码
            continue
        if re.match(r"^\d+[-–]\d+\.\s*[A-Da-d]+", s):  # 答案区间行（仅答案段）
            continue
        out.append(s)
    return out


def parse_questions(block):
    parts = re.split(r"(?m)^(?=\s*\d+[．.]\s*)", block)
    qs = []
    for p in parts:
        if not re.match(r"^\s*\d+[．.]\s*", p.strip()):
            continue
        mnum = re.match(r"^\s*(\d+)[．.]\s*([\s\S]*)", p.strip(), re.S)
        if not mnum:
            continue
        num = int(mnum.group(1))
        body = mnum.group(2)
        opts = OPT_RE.findall(body)
        if len(opts) != 4:
            continue
        opt_texts = [o[1].strip().replace("\n", " ") for o in opts]
        am = re.search(r"[ABCD]\s*[．.]", body)
        stem = re.sub(r"\s+", "", body[:am.start()].strip()) if am else re.sub(r"\s+", "", body)
        if re.search(r"依次填入|填入画横线|画横线部分", body):
            qtype = "逻辑填空"
        elif re.search(r"排列|语序|排序|将以上句子|语句", body):
            qtype = "语句表达"
        elif re.search(r"这段文字|这段话|主旨|意在说明|意在强调|标题|概括|观点|作者", body):
            qtype = "片段阅读"
        else:
            qtype = "片段阅读"
        if qtype == "逻辑填空":
            lens = [len(t.replace(" ", "")) for t in opt_texts]
            sub = "成语辨析" if all(l >= 4 for l in lens) else ("实词辨析" if all(l <= 3 for l in lens) else "混合填空")
        elif qtype == "语句表达":
            sub = "语句排序" if re.search(r"排列|排序|语序", body) else ("语句填空" if re.search(r"填空|填入", body) else "下文推断")
        else:
            sub = "阅读理解"
        qs.append({"num": num, "type": qtype, "subtype": sub,
                   "stem": stem, "options": ["A．" + opt_texts[0], "B．" + opt_texts[1],
                                            "C．" + opt_texts[2], "D．" + opt_texts[3]]})
    return qs


def parse(src_path, out_path):
    with open(src_path, encoding="utf-8") as f:
        raw = f.read()
    raw = re.sub(r"===== PAGE \d+ =====", "\n", raw)
    lines = raw.split("\n")
    lines = clean_lines(lines)

    sections = {}
    cur = None
    buf = []
    order = []
    for ln in lines:
        if NAME_RE.match(re.sub(r"\s+", "", ln)):
            nm = normalize_name(ln)
            if cur is not None:
                sections[cur] = sections.get(cur, "") + "\n".join(buf)
            cur = nm
            buf = []
            if nm not in order:
                order.append(nm)
            continue
        if cur is not None:
            buf.append(ln)
    if cur is not None:
        sections[cur] = sections.get(cur, "") + "\n".join(buf)

    # 答案段：扫描全文所有套题名，取相邻两名之间的文本，
    # 用区间格式 “start-end. LETTERS” 建立 {qnum: letter} 映射（按题号精确对齐）。
    answers = {}
    all_names = list(re.finditer(NAME_RE.pattern, raw, re.M))
    for i, mm in enumerate(all_names):
        nm = normalize_name(mm.group(0))
        end = all_names[i + 1].start() if i + 1 < len(all_names) else len(raw)
        span = raw[mm.start():end]
        letter_map = {}
        for rng in re.finditer(r"(\d+)\s*[-–]\s*(\d+)\s*\.?\s*([A-Da-d]+)", span):
            s = int(rng.group(1)); e = int(rng.group(2)); L = rng.group(3).upper()
            for k, ch in enumerate(L):
                qn = s + k
                if qn <= e:
                    letter_map[qn] = ch
        if letter_map:
            answers[nm] = letter_map

    allq = []
    report = []
    for nm in order:
        txt = sections.get(nm, "")
        qs = parse_questions(txt)
        ans_map = answers.get(nm, {})
        missing = 0
        for q in qs:
            a = ans_map.get(q["num"], "")
            if not a:
                missing += 1
            allq.append({"module": "言语理解", "type": q["type"], "subtype": q["subtype"],
                         "stem": q["stem"], "options": q["options"], "answer": a,
                         "tags": [nm], "column": nm, "source": "真题", "difficulty": 2,
                         "passage": "", "groupId": "", "figure": "", "paper": nm})
        report.append((nm, len(qs), len(ans_map), missing))

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    json.dump(allq, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("文件:", os.path.basename(src_path))
    print("套题数:", len(order), " 题目数:", len(allq))
    mismatch = [r for r in report if r[3] > 0 or r[1] != r[2]]
    for r in report:
        flag = "" if (r[3] == 0 and r[1] == r[2]) else "  <-- 答案未匹配%d题 / 答案区%d字母" % (r[3], r[2])
        print("  %-14s 题%d 答案区%d%s" % (r[0], r[1], r[2], flag))
    if mismatch:
        print("⚠ 需关注套题:", mismatch)
    return allq


def main():
    ap = argparse.ArgumentParser(description="解析欣说言语刷题集 .txt -> .json")
    ap.add_argument("--src", help="输入的 .txt 路径")
    ap.add_argument("--out", help="输出的 .json 路径")
    ap.add_argument("--batch", action="store_true", help="自动处理 inbox/pdf_text 下 xinshuo_up/down.txt")
    args = ap.parse_args()

    if args.batch or not args.src:
        pairs = [("xinshuo_up", "xinshuo_up"), ("xinshuo_down", "xinshuo_down")]
        for name, _ in pairs:
            src = os.path.join(DEFAULT_SRC_DIR, name + ".txt")
            out = os.path.join(DEFAULT_OUT_DIR, name + ".json")
            if os.path.exists(src):
                parse(src, out)
            else:
                print("跳过（不存在）:", src)
        return

    out = args.out or os.path.join(DEFAULT_OUT_DIR, os.path.splitext(os.path.basename(args.src))[0] + ".json")
    parse(args.src, out)


if __name__ == "__main__":
    main()
