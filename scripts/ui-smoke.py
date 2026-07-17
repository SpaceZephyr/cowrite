"""Headless smoke test for Cowrite's Page-level export workflows."""

import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


APP_URL = "http://127.0.0.1:4322/"
SCREENSHOT = Path("/tmp/cowrite-slide-modal.png")
IMPORT_SCREENSHOT = Path("/tmp/cowrite-import-modal.png")
CONVERSATION_SCREENSHOT = Path("/tmp/cowrite-conversation-toolbar.png")
LAYOUT_SCREENSHOT = Path("/tmp/cowrite-layout-modal.png")
COWRITE_SCREENSHOT = Path("/tmp/cowrite-creation-modal.png")
SEND_SCREENSHOT = Path("/tmp/cowrite-send-modal.png")


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
        page.get_by_title("展开目录").click()
        page.wait_for_timeout(250)
        sidebar_box = page.locator("aside.sidebar").bounding_box()
        workspace_box = page.locator("main.workspace").bounding_box()
        assert sidebar_box and sidebar_box["width"] >= 239
        assert workspace_box and workspace_box["x"] >= 239
        assert page.locator("aside.sidebar").evaluate("node => getComputedStyle(node).position") == "sticky"
        assert page.locator(".sidebar nav").evaluate("node => node.scrollWidth <= node.clientWidth")
        title_style = page.locator(".doc-title").first.evaluate(
            "node => ({ overflow: getComputedStyle(node).overflow, textOverflow: getComputedStyle(node).textOverflow, whiteSpace: getComputedStyle(node).whiteSpace })"
        )
        assert title_style == {"overflow": "hidden", "textOverflow": "ellipsis", "whiteSpace": "nowrap"}
        page.get_by_role("button", name="新建页面").click()
        with page.expect_file_chooser() as chooser_info:
            page.get_by_role("tab", name="导入 Markdown").click()
        chooser_info.value.set_files(
            {
                "name": "import-demo.md",
                "mimeType": "text/markdown",
                "buffer": b"# Imported Markdown\n\nLocal file body.",
            }
        )
        imported_title = page.get_by_placeholder("导入后的页面标题")
        imported_title.wait_for()
        expect(imported_title).to_have_value("Imported Markdown")
        assert page.get_by_role("button", name="导入页面").is_enabled()
        page.screenshot(path=str(IMPORT_SCREENSHOT), full_page=True)
        page.get_by_role("button", name="取消").click()
        page.get_by_text("欢迎使用 Cowrite", exact=True).click()
        editor = page.locator('.editor-holder [contenteditable="true"]:visible')
        editor.wait_for()
        expect(editor).not_to_have_text("")
        sidebar_top = page.locator("aside.sidebar").bounding_box()["y"]
        max_scroll = page.locator("main.workspace").evaluate("node => node.scrollHeight - node.clientHeight")
        assert max_scroll > 0
        page.locator("main.workspace").evaluate("node => node.scrollTop = Math.min(300, node.scrollHeight)")
        page.wait_for_timeout(100)
        assert page.locator("main.workspace").evaluate("node => node.scrollTop") > 0
        assert page.locator("aside.sidebar").bounding_box()["y"] == sidebar_top
        assert page.evaluate("window.scrollY") == 0
        page.locator("main.workspace").evaluate("node => node.scrollTop = 0")
        page.get_by_title("收起目录").click()
        page.wait_for_timeout(250)
        collapsed_sidebar = page.locator("aside.sidebar").bounding_box()
        collapsed_workspace = page.locator("main.workspace").bounding_box()
        assert collapsed_sidebar and collapsed_sidebar["width"] <= 1
        assert collapsed_workspace and collapsed_workspace["x"] <= 1

        selected_text = editor.inner_text().strip()
        assert selected_text
        editor.select_text()
        page.locator(".editor-holder").dispatch_event("mouseup")
        conversation_button = page.get_by_role("button", name="对话", exact=True)
        conversation_button.wait_for(state="attached")
        page.screenshot(path=str(CONVERSATION_SCREENSHOT), full_page=True)
        conversation_button.dispatch_event("mousedown")
        conversation_command = page.evaluate("navigator.clipboard.readText()")
        assert "我想这样修改" in conversation_command
        assert "引用原文：\n> " in conversation_command

        page.get_by_role("button", name="排版", exact=True).click()
        page.get_by_role("heading", name="选择排版").wait_for()
        page.screenshot(path=str(LAYOUT_SCREENSHOT), full_page=True)
        page.get_by_role("button", name="公众号排版").click()
        wechat_command = page.evaluate("navigator.clipboard.readText()")
        assert "space-wechat-layout" in wechat_command
        assert "index.html" in wechat_command
        assert "公众号排版预览" in wechat_command

        page.get_by_role("button", name="排版", exact=True).click()
        page.get_by_role("button", name="小红书排版").click()
        xhs_command = page.evaluate("navigator.clipboard.readText()")
        assert "baoyu-xhs-images" in xhs_command
        assert "GPT-Image-2 / LabNana" in xhs_command
        assert "aspect-ratio=3:4" in xhs_command

        active_content = page.evaluate("""async () => {
            const pages = await fetch('/api/pages').then((response) => response.json())
            const activeTitle = document.querySelector('.title-input').value
            const active = pages.find((item) => item.title === activeTitle)
            return fetch(`/api/pages/${active.id}`).then((response) => response.json()).then((item) => item.content)
        }""")
        page.get_by_role("button", name="Cowrite", exact=True).click()
        page.get_by_role("heading", name="Cowrite", exact=True).wait_for()
        page.get_by_role("button", name="按页面内容为要求创作").click()
        page_command = page.evaluate("navigator.clipboard.readText()")
        assert "以当前页面全文作为创作要求" in page_command
        assert active_content in page_command

        page.get_by_role("button", name="Cowrite", exact=True).click()
        page.get_by_role("button", name="输入自定义创作要求").click()
        requirement_input = page.get_by_placeholder("请输入创作要求")
        requirement_input.fill("续写一个真实案例")
        page.screenshot(path=str(COWRITE_SCREENSHOT), full_page=True)
        page.get_by_role("button", name="复制并发送到对话框").click()
        creation_command = page.evaluate("navigator.clipboard.readText()")
        assert "创作要求：续写一个真实案例" in creation_command
        assert "<cowrite-page-content>" in creation_command
        assert active_content in creation_command
        assert "cowrite_get_page" in creation_command
        assert "cowrite_update_page" in creation_command

        page.get_by_role("button", name="发送", exact=True).click()
        page.get_by_role("heading", name="发送", exact=True).wait_for()
        page.wait_for_timeout(250)
        page.screenshot(path=str(SEND_SCREENSHOT), full_page=True)
        expect(page.get_by_role("button", name="公众号 待完善")).to_be_disabled()
        expect(page.get_by_role("button", name="知乎 待完善")).to_be_disabled()
        page.get_by_role("button", name="飞书").click()
        page.get_by_text("发送到飞书？", exact=True).wait_for()
        page.get_by_role("button", name="确认并复制发送任务").click()
        lark_command = page.evaluate("navigator.clipboard.readText()")
        assert "lark-cli docs +create --api-version v2" in lark_command
        assert active_content in lark_command

        page.get_by_role("button", name="Slide").click()
        page.get_by_role("heading", name="生成 Slides").wait_for()
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
        print(f"wechat_command_length={len(wechat_command)}")
        print(f"xhs_command_length={len(xhs_command)}")
        print(f"creation_command_length={len(creation_command)}")
        print(f"conversation_command_length={len(conversation_command)}")
        print(f"screenshot={SCREENSHOT}")
        print(f"import_screenshot={IMPORT_SCREENSHOT}")
        print(f"conversation_screenshot={CONVERSATION_SCREENSHOT}")
        print(f"layout_screenshot={LAYOUT_SCREENSHOT}")
        print(f"cowrite_screenshot={COWRITE_SCREENSHOT}")
        print(f"send_screenshot={SEND_SCREENSHOT}")
        browser.close()


if __name__ == "__main__":
    main()
