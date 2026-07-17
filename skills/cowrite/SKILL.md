---
name: cowrite
description: Write or edit Markdown pages in the user's local Cowrite canvas. Use when the user asks to create an article/document "in cowrite", modify existing cowrite content, or fulfill a cowrite page's creation prompt. Also triggers on pasted commands that mention cowrite page IDs.
---

# Cowrite

Cowrite is a local Notion-like writing canvas. An installed plugin automatically prepares and starts the production canvas at `http://127.0.0.1:4320`; source development uses Vite (normally `http://127.0.0.1:4321`). The user sees every page in a live browser editor and can edit at any time. You operate the same pages through the `cowrite_*` MCP tools; your writes appear in the user's editor within seconds.

## Tools

1. `cowrite_get_status` — verify the service and return the local browser canvas URL. Use when the user asks to start/open Cowrite.
2. `cowrite_list_pages` — list pages (title, creation prompt, revision; no content). Pages with a `prompt` and `revision: 1` are waiting to be written.
3. `cowrite_get_page` — read one page with full Markdown content and current `revision`. Always call immediately before updating.
4. `cowrite_create_page` — create a page with finished Markdown content. Use when the user says "在 cowrite 里创建/写一篇 …".
5. `cowrite_update_page` — replace a page's Markdown content. Requires `expected_revision` from `cowrite_get_page`.

6. `cowrite_upload_asset` — copy a local image or self-contained HTML file into Cowrite's asset store; returns a `/assets/...` url.
7. `cowrite_insert_after` — insert one Markdown/HTML block right after the paragraph containing an exact anchor substring. Requires `expected_revision`.

## Typical tasks

- **Create**: the user describes what to write → write the article in Markdown → `cowrite_create_page` with a clear title and the full content. Tell the user the page is ready in Cowrite.
- **Fulfill a creation prompt**: a pasted command names a page ID, or `cowrite_list_pages` shows a pending page → read it, write content that satisfies its `prompt`, update it.
- **Modify**: the user references an existing page ("那篇 X 的文章") → find it via `cowrite_list_pages`, read it, apply the requested change while preserving everything else, write back.

- **Illustrate a passage** (pasted command with anchor text, asking for 配图): MUST use the bundled `image-studio` Skill and its GPT-Image-2 / LabNana workflow. The Cowrite command supplies explicit confirmations for type, content, style, and automatic prompt mode. Never silently switch to another image model. Upload the generated PNG with `cowrite_upload_asset`, then insert `![插图](url)` with `cowrite_insert_after`.
- **HTML/PPT explainer** (pasted command asking for HTML or 解释图): MUST use the bundled `text-logic-diagram` Skill in its Cowrite embed profile. Produce ONE self-contained 16:9 light-theme HTML/SVG slide, upload it, then insert the iframe with `cowrite_insert_after`.
- **Polish selected text** (pasted command asking for 优化): MUST use bundled `ai-writing-assistant`, Method 5 / Cowrite local optimization mode. Replace only the exact selected passage and preserve the rest of the page byte-for-byte.
- **Convert a Page to Slides** (pasted command from the Page-level Slide button): MUST use bundled `space-multi-design-ppt`. The command already confirms PPTX or HTML, smart brand matching, automatic page count, and one-click outline authorization. Read the complete current page, generate only the requested final `.pptx` or `deck.html`, upload it, re-read the latest revision, and insert one Markdown delivery link immediately after the first heading. Never replace page content with the deck or insert intermediate files.
- **Lay out a Page for WeChat** (pasted command from the Page-level 排版 button): MUST use bundled `space-wechat-layout`. Treat style as “你来定” and select Claude, OpenAI, or Google from the article type. Preserve the article, produce one self-contained `index.html` with copyable inline-styled rich HTML, upload it, re-read the latest revision, and insert one Markdown preview link immediately after the first heading. Never replace the Markdown article or insert source code.
- **Lay out a Page for Xiaohongshu** (pasted command from 排版 → 小红书排版): MUST use bundled `baoyu-xhs-images` for analysis, two required confirmations, three outline strategies, and prompt assembly; use bundled `image-studio` with GPT-Image-2 / LabNana for final 3:4 PNGs. Upload only the successful final image series and insert it as one ordered Markdown image block after the first heading. Preserve the source article and never skip the Skill's first-time preference setup or two confirmations.

## Writing rules

- Content is Markdown. Use headings, lists, and tables; no HTML unless asked.
- Follow the user's writing style guide if the workspace has one (e.g. `10 mirror/写作风格.md` in the Obsidian vault).
- The user may edit while you work: always pass `expected_revision`; on a 409 conflict, re-read, merge your change into the latest content, and retry once. Never overwrite human edits.
- Preserve existing content unless the user asked for a rewrite. For partial edits, change only the requested part.

## Service check

Installed plugin: the MCP runner starts the production canvas automatically. Call `cowrite_get_status`; if startup failed, report its stderr message (Node/npm, port 4320, build, or permissions) and retry after fixing it. Source development: run `npm run dev` in the Cowrite repository.
