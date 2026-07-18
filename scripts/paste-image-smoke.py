#!/usr/bin/env python3
"""Regression check: pasted images must upload as assets, never enter Markdown as base64."""

from __future__ import annotations

import json
import os
import time
import urllib.request
from contextlib import suppress

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("COWRITE_URL", "http://127.0.0.1:4322")
CHROME = os.environ.get(
    "PLAYWRIGHT_CHROMIUM_EXECUTABLE",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)


def api(path: str, method: str = "GET", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        BASE_URL + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def main() -> None:
    created = api("/api/pages", "POST", {"title": "粘贴图片回归测试", "content": "# 粘贴图片回归测试\n\n正文"})
    page_id = created["id"]
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
            context = browser.new_context(
                viewport={"width": 1200, "height": 800},
                permissions=["clipboard-read", "clipboard-write"],
            )
            page = context.new_page()
            upload_responses: list[int] = []
            page.on(
                "response",
                lambda response: upload_responses.append(response.status)
                if "/api/assets/upload" in response.url
                else None,
            )
            page.goto(BASE_URL, wait_until="networkidle")
            page.get_by_text("粘贴图片回归测试", exact=True).first.click(force=True)
            editor = page.locator(".vditor-ir > .vditor-reset").first
            editor.wait_for(state="visible")
            editor.click()
            blob_size = page.evaluate(
                """async () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 512;
                  canvas.height = 512;
                  const context = canvas.getContext('2d');
                  const image = context.createImageData(512, 512);
                  let seed = 123456789;
                  for (let index = 0; index < image.data.length; index += 4) {
                    seed = (1664525 * seed + 1013904223) >>> 0;
                    image.data[index] = seed & 255;
                    image.data[index + 1] = (seed >>> 8) & 255;
                    image.data[index + 2] = (seed >>> 16) & 255;
                    image.data[index + 3] = 255;
                  }
                  context.putImageData(image, 0, 0);
                  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                  await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
                  return blob.size;
                }"""
            )
            started = time.perf_counter()
            before_html = editor.inner_html()
            page.keyboard.press("Meta+V")
            page.wait_for_timeout(300)
            if editor.inner_html() == before_html:
                page.keyboard.press("Control+V")
            page.wait_for_timeout(2500)
            elapsed_ms = (time.perf_counter() - started) * 1000
            page.evaluate(
                """() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 8;
                  canvas.height = 8;
                  const context = canvas.getContext('2d');
                  context.fillStyle = '#5e6ad2';
                  context.fillRect(0, 0, 8, 8);
                  const transfer = new DataTransfer();
                  transfer.setData('text/html', `<p>rich clipboard</p><img src="${canvas.toDataURL('image/png')}">`);
                  document.querySelector('.vditor-ir > .vditor-reset').dispatchEvent(new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                  }));
                }"""
            )
            page.wait_for_timeout(1500)
            editor_html = editor.inner_html()
            latest = api(f"/api/pages/{page_id}")
            content = latest["content"]
            print({
                "elapsed_ms": round(elapsed_ms),
                "blob_size": blob_size,
                "content_length": len(content),
                "contains_base64": "data:image/" in content,
                "dom_contains_base64": "data:image/" in editor_html,
                "contains_asset": "/assets/" in content,
                "dom_contains_asset": "/assets/" in editor_html,
                "upload_responses": upload_responses,
            })
            assert "data:image/" not in content, "pasted image was serialized into Markdown as a base64 data URL"
            assert "data:image/" not in editor_html, "pasted image inserted a base64 data URL into the editor DOM"
            assert "/assets/" in content, "pasted image was not replaced by a Cowrite asset URL"
            assert upload_responses == [201, 201], "file and rich-HTML image paste paths did not each upload exactly once"
            assert len(content) < 5_000, "pasted image made the Markdown payload unexpectedly large"
            assert elapsed_ms < 4_000, "pasting an image blocked the page for too long"
            browser.close()
    finally:
        with suppress(Exception):
            api(f"/api/pages/{page_id}", "DELETE")


if __name__ == "__main__":
    main()
