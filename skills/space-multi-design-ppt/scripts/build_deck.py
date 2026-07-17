#!/usr/bin/env python3
"""Merge per-slide HTML files into a single self-contained deck.html.

Usage:
    python3 build_deck.py <slides_dir> --output deck.html --title "My Deck"

Each slide is a standalone 1280x720 HTML file. They are embedded as sandboxed
iframes (srcdoc) inside a viewer shell with keyboard navigation, fullscreen,
grid overview, and URL-hash deep links. No external dependencies.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

VIEWER_TEMPLATE = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>__TITLE__</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:100%; height:100%; background:#111; overflow:hidden; font-family:-apple-system,"PingFang SC","Segoe UI",sans-serif; }
  #stage { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  #frame-wrap { position:relative; width:1280px; height:720px; transform-origin:center center; background:#000; box-shadow:0 20px 80px rgba(0,0,0,.6); }
  #frame-wrap iframe { width:1280px; height:720px; border:0; display:block; }
  #hud { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); color:rgba(255,255,255,.75); background:rgba(0,0,0,.55); backdrop-filter:blur(8px); padding:6px 16px; border-radius:20px; font-size:13px; user-select:none; z-index:20; display:flex; gap:14px; align-items:center; transition:opacity .4s; }
  #hud.faded { opacity:0; }
  #hud button { background:none; border:0; color:rgba(255,255,255,.75); font-size:15px; cursor:pointer; }
  #grid { position:fixed; inset:0; background:rgba(10,10,10,.97); z-index:30; overflow-y:auto; padding:40px; display:none; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:24px; align-content:start; }
  #grid.open { display:grid; }
  .thumb { cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid transparent; position:relative; aspect-ratio:16/9; background:#000; }
  .thumb:hover { border-color:#888; }
  .thumb.current { border-color:#fff; }
  .thumb iframe { width:1280px; height:720px; border:0; transform:scale(calc(280/1280)); transform-origin:top left; pointer-events:none; }
  .thumb .num { position:absolute; bottom:6px; right:8px; color:#fff; font-size:12px; background:rgba(0,0,0,.6); padding:2px 8px; border-radius:10px; }
  #hint { position:fixed; top:16px; right:20px; color:rgba(255,255,255,.4); font-size:12px; z-index:20; }
</style>
</head>
<body>
<div id="stage"><div id="frame-wrap"><iframe id="slide-frame" sandbox="allow-same-origin"></iframe></div></div>
<div id="hud">
  <button onclick="prev()">&#8592;</button>
  <span id="page-ind">1 / 1</span>
  <button onclick="next()">&#8594;</button>
  <button onclick="toggleGrid()" title="G">&#9638;</button>
  <button onclick="toggleFS()" title="F">&#x26F6;</button>
</div>
<div id="hint">←/→ 翻页 · F 全屏 · G 总览</div>
<div id="grid"></div>
<script>
const SLIDES = __SLIDES_JSON__;
let cur = 0;
const frame = document.getElementById('slide-frame');
const ind = document.getElementById('page-ind');
const grid = document.getElementById('grid');
const hud = document.getElementById('hud');
let hudTimer;

function show(i, push=true) {
  cur = Math.max(0, Math.min(SLIDES.length-1, i));
  frame.srcdoc = SLIDES[cur];
  ind.textContent = (cur+1) + ' / ' + SLIDES.length;
  if (push) location.hash = '#' + (cur+1);
  document.querySelectorAll('.thumb').forEach((t,j)=>t.classList.toggle('current', j===cur));
  wakeHud();
}
function next(){ show(cur+1); } function prev(){ show(cur-1); }
function toggleFS(){ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
function toggleGrid(){ grid.classList.toggle('open'); }
function fit(){
  const s = Math.min(innerWidth/1280, innerHeight/720) * (document.fullscreenElement ? 1 : 0.92);
  document.getElementById('frame-wrap').style.transform = 'scale(' + s + ')';
}
function wakeHud(){ hud.classList.remove('faded'); clearTimeout(hudTimer); hudTimer = setTimeout(()=>hud.classList.add('faded'), 2500); }
addEventListener('resize', fit);
addEventListener('mousemove', wakeHud);
addEventListener('keydown', e => {
  if (e.key==='ArrowRight'||e.key===' '||e.key==='PageDown') { e.preventDefault(); next(); }
  else if (e.key==='ArrowLeft'||e.key==='PageUp') { e.preventDefault(); prev(); }
  else if (e.key==='f'||e.key==='F') toggleFS();
  else if (e.key==='g'||e.key==='G') toggleGrid();
  else if (e.key==='Escape') grid.classList.remove('open');
  else if (e.key==='Home') show(0);
  else if (e.key==='End') show(SLIDES.length-1);
});
// grid thumbnails
SLIDES.forEach((s,i)=>{
  const d = document.createElement('div');
  d.className = 'thumb';
  const f = document.createElement('iframe');
  f.setAttribute('sandbox','allow-same-origin');
  f.srcdoc = s;
  const n = document.createElement('span');
  n.className = 'num'; n.textContent = i+1;
  d.appendChild(f); d.appendChild(n);
  d.onclick = ()=>{ grid.classList.remove('open'); show(i); };
  grid.appendChild(d);
});
const h = parseInt((location.hash||'').slice(1));
show(isNaN(h) ? 0 : h-1, false);
fit(); wakeHud();
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slides_dir", help="Directory containing NN-*.html slide files")
    ap.add_argument("--output", "-o", default="deck.html")
    ap.add_argument("--title", "-t", default="Slide Deck")
    args = ap.parse_args()

    slides_dir = Path(args.slides_dir)
    files = sorted(
        [p for p in slides_dir.glob("*.html") if re.match(r"^\d+", p.name)],
        key=lambda p: p.name,
    )
    if not files:
        sys.exit(f"No numbered slide HTML files found in {slides_dir}")

    slides = [p.read_text(encoding="utf-8") for p in files]
    out = VIEWER_TEMPLATE.replace("__TITLE__", html.escape(args.title)).replace(
        "__SLIDES_JSON__", json.dumps(slides, ensure_ascii=False)
    )
    Path(args.output).write_text(out, encoding="utf-8")
    print(f"OK: {args.output} ({len(files)} slides: {', '.join(p.name for p in files)})")


if __name__ == "__main__":
    main()
