# -*- coding: utf-8 -*-
"""公開前の点検：個人や会社を特定できる情報が残っていないかを調べる。

使い方（リポジトリの一番上で）:
    python privacy_check.py

調べるもの:
  ・git で管理しているファイル全部（HTML・Markdown・スクリプト・Word・PowerPoint・Excel・zip の中身。PDF は pdftotext があれば）
  ・メールアドレス、電話番号、郵便番号、Google のフォームやスクリプトの個別ID
  ・Office ファイルの作成者・最終更新者
  ・.privacy_words.txt に書いた言葉（受講者の名前・社名など。1行に1語）

.privacy_words.txt は .gitignore に入れてあり、公開されない。見つかったら終了コード 1 で終わる。
"""
import io, os, re, subprocess, sys, zipfile, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
WORDS_FILE = os.path.join(ROOT, ".privacy_words.txt")
SKIP = {"privacy_check.py"}
# 問題にしないもの（予約済みドメイン・自動の宛先・公開用の自分のURL）
ALLOW = [r"@example\.(com|net|org)", r"noreply@", r"yusuke-aoki-bit\.github\.io"]

PATTERNS = [
    ("メールアドレス", r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    ("電話番号", r"(?<![\d.])0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)"),
    ("郵便番号", r"〒\s?\d{3}-?\d{4}"),
    ("Googleの個別ID", r"(docs|script)\.google\.com/[^\s\"'<>]*?/d/[A-Za-z0-9_-]{20,}|script\.google\.com/home/projects/[A-Za-z0-9_-]{20,}"),
]

def tracked():
    out = subprocess.run(["git", "-c", "core.quotepath=false", "ls-files", "-z"], cwd=ROOT, capture_output=True).stdout
    return [f for f in out.decode("utf-8").split("\0") if f and os.path.basename(f) not in SKIP]

def ooxml(data):
    texts, meta = [], []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for n in z.namelist():
            if not n.endswith(".xml"):
                continue
            x = z.read(n).decode("utf-8", "ignore")
            if n.startswith("docProps/"):
                for tag in ("dc:creator", "cp:lastModifiedBy", "Company", "Manager"):
                    for v in re.findall(r"<%s>([^<]*)" % tag, x):
                        meta.append("%s=%s" % (tag, v))
            texts.append(re.sub(r"<[^>]+>", " ", x))
    return " ".join(texts), meta

def pdf(path):
    if not shutil.which("pdftotext"):
        return None
    r = subprocess.run(["pdftotext", "-q", path, "-"], capture_output=True)
    return r.stdout.decode("utf-8", "ignore")

def text_of(name, data, path=None):
    ext = os.path.splitext(name)[1].lower()
    if ext in (".docx", ".pptx", ".xlsx"):
        return ooxml(data)
    if ext == ".pdf":
        return (pdf(path) if path else None), []
    if ext == ".zip":
        parts, meta = [], []
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for n in z.namelist():
                if n.endswith("/"):
                    continue
                t, m = text_of(n, z.read(n))
                if t:
                    parts.append(t)
                meta += m
        return " ".join(parts), meta
    if ext in (".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"):
        return None, []
    return data.decode("utf-8", "ignore"), []

def main():
    words = []
    if os.path.exists(WORDS_FILE):
        words = [w.strip() for w in open(WORDS_FILE, encoding="utf-8") if w.strip() and not w.startswith("#")]
    hits, skipped = [], []
    for f in tracked():
        p = os.path.join(ROOT, f)
        if not os.path.isfile(p):
            continue
        t, meta = text_of(f, open(p, "rb").read(), p)
        if t is None:
            if f.lower().endswith(".pdf"):
                skipped.append(f)
            continue
        for m in meta:
            v = m.split("=", 1)[1]
            if v and v not in ("AI実装講座 事務局", "経営者のためのAI実装講座", "PptxGenJS", "openpyxl", "Un-named"):
                hits.append((f, "作成者の情報", m))
        for label, pat in PATTERNS:
            for mt in re.finditer(pat, t):
                s = mt.group(0)
                if any(re.search(a, s) for a in ALLOW):
                    continue
                hits.append((f, label, s))
        for w in words:
            if w in t:
                hits.append((f, "要注意の言葉", w))
    seen = set()
    for h in hits:
        if h in seen:
            continue
        seen.add(h)
        print("%s\t%s\t%s" % (h[1], h[2], h[0]))
    if skipped:
        print("（PDF %d 件は pdftotext が無いので中身を見ていません）" % len(skipped))
    if not words:
        print("（.privacy_words.txt が無いので、名前や社名の点検はしていません）")
    print("見つかったもの：%d 件" % len(seen))
    sys.exit(1 if seen else 0)

if __name__ == "__main__":
    main()
