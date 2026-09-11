from playwright.sync_api import sync_playwright
import urllib.request
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1150,"height":950})
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    r=pg.goto("http://127.0.0.1:8899/slides.html", wait_until="networkidle")
    print("status",r.status,"| title:",pg.title())
    hrefs=pg.eval_on_selector_all(".dl a","els=>els.map(e=>e.getAttribute('href'))")
    print("links:",len(hrefs))
    bad=[]
    for h in hrefs:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8899/"+h) as resp:
                if resp.status!=200: bad.append((h,resp.status))
        except Exception as e: bad.append((h,str(e)[:50]))
    print("broken:",bad)
    pg.screenshot(path="shot_slides.png")
    pg2=b.new_page(viewport={"width":390,"height":800})
    pg2.goto("http://127.0.0.1:8899/slides.html", wait_until="networkidle")
    print("mobile",pg2.evaluate("document.documentElement.scrollWidth"),pg2.evaluate("document.documentElement.clientWidth"))
    pg.goto("http://127.0.0.1:8899/index.html", wait_until="networkidle")
    print("index->slides:",pg.eval_on_selector_all("a[href='slides.html']","e=>e.length"))
    print("errors:",errs); b.close()
