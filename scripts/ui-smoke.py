"""Headless smoke test for Cowrite's Page Slide workflow."""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright


APP_URL = "http://127.0.0.1:4322/"
SCREENSHOT = Path("/tmp/cowrite-slide-modal.png")


def main() -> None:
    with sync_playwright() as playwright:
        executable_path = os.getenv("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=executable_path,
        )
        context = browser.new_context(
            permissions=["clipboard-read", "clipboard-write"]
        )
        page = context.new_page()
        page.goto(APP_URL, wait_until="networkidle")

        buttons = page.get_by_role("button").all_inner_texts()
        print(f"buttons={buttons}")
        page.get_by_role("button", name="Slide").click()
        page.get_by_role("heading", name="把当前 Page 变成 Slides").wait_for()
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        page.get_by_role("button", name="PPT").click()
        ppt_command = page.evaluate("navigator.clipboard.readText()")
        assert "space-multi-design-ppt" in ppt_command
        assert ".pptx" in ppt_command

        page.get_by_role("button", name="Slide").click()
        page.get_by_role("button", name="HTML").click()
        html_command = page.evaluate("navigator.clipboard.readText()")
        assert "space-multi-design-ppt" in html_command
        assert "build_deck.py" in html_command
        assert "deck.html" in html_command

        print(f"ppt_command_length={len(ppt_command)}")
        print(f"html_command_length={len(html_command)}")
        print(f"screenshot={SCREENSHOT}")
        browser.close()


if __name__ == "__main__":
    main()
