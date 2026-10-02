#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_pdf.py —— 把 PDF 抽取成纯文本，并自动探测是否为「扫描图片版」。

用法：
  python scripts/extract_pdf.py INPUT.pdf [INPUT2.pdf ...] [-o OUTDIR]
  python scripts/extract_pdf.py some_dir/            # 递归匹配目录里所有 *.pdf

说明：
  - 默认 OUTDIR = <仓库根>/inbox/pdf_text，每个 PDF 输出同名 .txt
  - 使用 pdfplumber 抽取「文字层」；若未安装会提示 `pip install pdfplumber`
  - 【关键】扫描版 PDF 没有任何文字层，抽取出来是空的。脚本会统计
    总有效字符数，若平均每页 < 20 字符，则打印醒目警告，提示需要先
    用 OCR（如 tesseract + 中文语言包，或 WPS / Adobe / 微信 的图片识别）
    把 PDF 转成文字后，再把 .txt 交给 parse_*.py / ingest.js。
  - 抽取时在每个分页处写入标记 `===== PAGE n =====`，便于下游 parser 清洗。

依赖：pip install pdfplumber
"""
import sys, os, argparse, glob

try:
    import pdfplumber
except ImportError:
    sys.stderr.write("❌ 未找到 pdfplumber，请先执行：pip install pdfplumber\n")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, "inbox", "pdf_text")

# 平均每页有效字符低于该值，判定为「扫描图片版 / 无文字层」
SCAN_THRESHOLD = 20


def is_scan(total_chars, pages):
    if pages == 0:
        return False
    return (total_chars / pages) < SCAN_THRESHOLD


def extract(pdf_path, out_path):
    with pdfplumber.open(pdf_path) as pdf:
        pages = len(pdf.pages)
        chunks = []
        total = 0
        for i, page in enumerate(pdf.pages):
            txt = page.extract_text() or ""
            total += len(txt.strip())
            chunks.append("\n===== PAGE %d =====\n" % (i + 1))
            chunks.append(txt)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(chunks))
    return pages, total


def main():
    ap = argparse.ArgumentParser(description="PDF 抽取纯文本 + 扫描版探测")
    ap.add_argument("inputs", nargs="+", help="PDF 文件，或目录（递归匹配 *.pdf）")
    ap.add_argument("-o", "--out", default=DEFAULT_OUT, help="输出目录（默认 inbox/pdf_text）")
    args = ap.parse_args()

    pdfs = []
    for it in args.inputs:
        if os.path.isdir(it):
            pdfs += sorted(glob.glob(os.path.join(it, "**", "*.pdf"), recursive=True))
        else:
            pdfs.append(it)
    if not pdfs:
        print("没有找到 PDF 文件")
        return

    scanned = []
    for fp in pdfs:
        base = os.path.splitext(os.path.basename(fp))[0]
        out = os.path.join(args.out, base + ".txt")
        try:
            pages, total = extract(fp, out)
        except Exception as e:
            print("  ❌ 抽取失败:", fp, "->", e)
            continue
        scan = is_scan(total, pages)
        if scan:
            scanned.append(os.path.basename(fp))
        flag = ("⚠️ 疑似扫描图片版（无文字层），需先用 OCR 转文字再导入！"
                if scan else "✅ 含文字层，可直接解析")
        print("  %s -> %s  (页数 %d, 文字 %d 字符)  %s"
              % (os.path.basename(fp), out, pages, total, flag))

    if scanned:
        print("\n⚠️ 以下文件疑似扫描版，本管线无法直接解析，请先用 OCR 转成文字：")
        for s in scanned:
            print("   -", s)
    print("DONE")


if __name__ == "__main__":
    main()
