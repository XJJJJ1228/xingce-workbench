#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_guoxi.py —— 解析「郭熙言语必刷 100 题」排版为结构化题目。

排版特征：
  - 题干以「数字.（年份 地区）」起头，如「1.（2023 国考）……」
  - 选项 A．B．C．D．
  - 答案另存于单独的「纯答案」PDF，格式为每 10 题一组的 10 个字母（共 10 组）

用法：
  python scripts/parse_guoxi.py \
      --q inbox/pdf_text/guoxi_q.txt \
      --a inbox/pdf_text/guoxi_a.txt \
      --out inbox/parsed/guoxi.json

依赖：仅标准库
"""
import re, json, os, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_Q = os.path.join(ROOT, "inbox", "pdf_text", "guoxi_q.txt")
DEFAULT_A = os.path.join(ROOT, "inbox", "pdf_text", "guoxi_a.txt")
DEFAULT_OUT = os.path.join(ROOT, "inbox", "parsed", "guoxi.json")


def parse(q_path, a_path, out_path):
    with open(q_path, encoding="utf-8") as f:
        text = f.read()
    with open(a_path, encoding="utf-8") as f:
        ans_text = f.read()

    text = re.sub(r"===== PAGE \d+ =====", "\n", text)

    lines = text.split("\n")
    clean = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if re.search(r"金题精练班讲义|iinndddd|22002255|1188::0055|公众号|用心帮助", s):
            continue
        if re.fullmatch(r"\d{1,3}", s):  # 纯页码
            continue
        if re.fullmatch(r"第二篇 言语理解与表达", s):
            continue
        if re.match(r"言语必刷 100 题", s):
            continue
        clean.append(s)
    text = "\n".join(clean)

    parts = re.split(r"(?m)^(?=\s*\d+[．.][（(])", text)
    blocks = [p.strip() for p in parts if re.match(r"^\s*\d+[．.][（(]", p.strip())]
    print("题目块数:", len(blocks))

    ans_letters = []
    for m in re.finditer(r"[A-Da-d]{10}", ans_text.replace(" ", "").replace("\n", "")):
        seg = m.group(0).upper()
        if len(seg) == 10:
            ans_letters.append(seg)
    print("答案篇数:", len(ans_letters), "总字母:", sum(len(x) for x in ans_letters))

    questions = []
    problems = []
    for idx, b in enumerate(blocks):
        mnum = re.match(r"^\s*(\d+)[．.]\s*([\s\S]*)", b, re.S)
        if not mnum:
            problems.append(("nonumber", b[:40]))
            continue
        num = int(mnum.group(1))
        body = mnum.group(2)
        myr = re.match(r"[（(]\s*(\d{4})\s*([^）)]*?)\s*[）)]", body)
        year = myr.group(1) if myr else ""
        region = myr.group(2).strip() if myr else ""
        after = body[myr.end():] if myr else body
        opts = re.findall(r"([ABCD])\s*[．.]\s*([\s\S]*?)(?=\s*[ABCD]\s*[．.]|$)", after)
        if len(opts) != 4:
            problems.append((num, "opts=%d" % len(opts)))
            continue
        opt_texts = [o[1].strip().replace("\n", " ") for o in opts]
        am = re.search(r"[ABCD]\s*[．.]", after)
        stem = re.sub(r"\s+", "", after[:am.start()].strip()) if am else re.sub(r"\s+", "", after)
        page_i = idx // 10
        letter_i = idx % 10
        ans = ""
        if page_i < len(ans_letters):
            ans = ans_letters[page_i][letter_i]
        if re.search(r"依次填入|填入画横线|画横线部分", body):
            qtype = "逻辑填空"
        elif re.search(r"这段文字|这段话|主旨|意在说明|作者|标题|概括", body):
            qtype = "片段阅读"
        else:
            qtype = "逻辑填空"
        lens = [len(t.replace(" ", "")) for t in opt_texts]
        if qtype == "逻辑填空":
            if all(l >= 4 for l in lens):
                sub = "成语辨析"
            elif all(l <= 3 for l in lens):
                sub = "实词辨析"
            else:
                sub = "混合填空"
        else:
            sub = ""
        tags = []
        if year:
            tags.append(year + (region if region else ""))
        questions.append({
            "num": num, "module": "言语理解", "type": qtype, "subtype": sub,
            "stem": stem, "options": ["A．" + opt_texts[0], "B．" + opt_texts[1],
                                     "C．" + opt_texts[2], "D．" + opt_texts[3]],
            "answer": ans, "tags": tags, "column": "2025郭熙100题",
            "year": year, "region": region,
            "source": "真题", "difficulty": 2, "passage": "", "groupId": "", "figure": ""
        })

    print("解析成功:", len(questions), "问题:", len(problems))
    for p in problems[:20]:
        print("  PROBLEM", p)
    miss = [q["num"] for q in questions if not q["answer"]]
    print("缺答案题号:", miss[:20])

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=1)
    print("写入", out_path)


def main():
    ap = argparse.ArgumentParser(description="解析郭熙100题 .txt -> .json")
    ap.add_argument("--q", default=DEFAULT_Q, help="题干 .txt")
    ap.add_argument("--a", default=DEFAULT_A, help="答案 .txt")
    ap.add_argument("--out", default=DEFAULT_OUT, help="输出 .json")
    args = ap.parse_args()
    parse(args.q, args.a, args.out)


if __name__ == "__main__":
    main()
