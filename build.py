# -*- coding: utf-8 -*-
import re, os, io

PAGES = [
    ("index.html",        "全体像",     "src/index_body.html",
     "経営者向けAI実装講座の制作物インデックス。どの資料をいつ使うか、設計判断の理由、次にやること。"),
    ("deliverables.html", "成果物イメージ", "src/deliverables_body.html",
     "1対1版（全12回・24時間）で受講者が持ち帰る成果物7点の完成イメージ。"),
    ("roadmap.html",      "学習ロードマップ", "src/roadmap_body.html",
     "AI講師が受講者の一歩先を歩き続けるための学習計画。進捗はブラウザに保存されます。"),
    ("forms.html",        "フォーム設置手順", "src/forms_body.html",
     "Apps Scriptで診断フォーム3つと自動採点シートを10分で立ち上げる手順。"),
    ("slides.html",       "登壇資料", "src/slides_body.html",
     "全12回の画面共有用スライド（各回15枚・PPTX）と、読むだけで分かる各回の資料（PDF）。"),
    ("models.html",       "モデルと用語", "src/models_body.html",
     "主要生成AIモデルの知能スコア・API単価・月額プラン・コスト試算と、用途別の使い分け、用語集。2026年9月版。"),
    ("student.html",      "受講のご案内", "src/student_body.html",
     "受講が決まった方へ。初回の持ち物、各回の準備、12回の流れ、用語、よくあるご質問。"),
]

# 受講者向けページには講師用ナビを出さない
NO_NAV = {"student.html"}

NAV_ITEMS = [(f, label) for f, label, _, _ in PAGES if f not in NO_NAV]

def nav(current):
    if current in NO_NAV:
        return ""
    links = []
    for f, label in NAV_ITEMS:
        cur = ' aria-current="page"' if f == current else ''
        links.append('<a href="%s"%s>%s</a>' % (f, cur, label))
    return ('<nav class="sitenav"><div class="sitenav-in">'
            '<span class="brand">AI実装講座 1対1版</span>'
            '<span class="links">%s</span></div></nav>' % "".join(links))

TPL = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="googlebot" content="noindex,nofollow">
<meta name="description" content="{desc}">
<title>{title}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2214%22 font-size=%2214%22>{emoji}</text></svg>">
<link rel="stylesheet" href="assets/nav.css">
<style>:root{{color-scheme:light dark}}body{{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
{nav}
{body}
</body>
</html>
"""

EMOJI = {"index.html":"🗂️","deliverables.html":"📐","roadmap.html":"🧭","forms.html":"📋","slides.html":"🖥️","models.html":"🧮","student.html":"📘"}

for out, label, src, desc in PAGES:
    raw = io.open(src, encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>\s*", raw, re.S)
    title = m.group(1).strip() if m else label
    body = raw[:m.start()] + raw[m.end():] if m else raw
    html = TPL.format(title=title + "｜AI実装講座", desc=desc, nav=nav(out),
                      body=body.strip(), emoji=EMOJI[out])
    io.open(out, "w", encoding="utf-8").write(html)
    print(out, len(html))

io.open("robots.txt","w",encoding="utf-8").write("User-agent: *\nDisallow: /\n")
io.open(".nojekyll","w",encoding="utf-8").write("")
print("robots.txt / .nojekyll")
