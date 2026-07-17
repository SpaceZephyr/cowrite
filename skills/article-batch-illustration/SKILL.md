---
name: article-batch-illustration
description: Analyze a complete Markdown article, plan a restrained set of illustration positions, and generate consistent article images through Cowrite's bundled image-studio. Use for 整篇配图, 批量配图, 给文章配图, or pasted Cowrite full-page illustration commands.
---

# Article Batch Illustration for Cowrite

Plan and generate a coherent illustration set for one complete Cowrite Markdown page. This Skill owns article analysis and placement. The bundled `image-studio` Skill owns prompt assembly and generation through Codex's built-in `image_gen` tool.

## Fixed Cowrite profile

- Output: PNG, 16:9, 2K
- Image type: image-studio type D / article logic illustration
- Generation path: Codex built-in `image_gen` tool only; one tool call per image
- Language: Simplified Chinese; technical abbreviations may remain English
- Count: normally 2-6; use fewer for short articles
- Placement: after an exact, unique Markdown heading or paragraph anchor
- Page safety: never rewrite the source article; insert only successful final images

Never use LabNana, Gemini, an API/CLI image generator, an embedded API key, web image search, or another model. If built-in `image_gen` is unavailable or fails, report the failure and leave the page unchanged.

## Phase 1: analyze and select positions

1. Read the latest Cowrite page through `cowrite_get_page`.
2. Ignore frontmatter, references, footnotes, existing delivery links, and existing images whose alt text starts with `文章配图`.
3. Split primarily on H2/H3 headings. For heading-free prose, use major topic transitions.
4. For every candidate, record:
   - exact unique anchor from the current Markdown;
   - one-sentence core point;
   - 3-5 key concepts;
   - best structure: concept, flow, comparison, hierarchy, relationship, or matrix.
5. Select only positions where a diagram materially improves comprehension. Do not illustrate every section and do not create decorative filler.
6. Keep the set between 2 and 6 unless the article is too short. Prefer fewer, stronger images.

## Phase 2: establish one visual system

Choose one image-studio style for the whole set based on the article:

- product/general explanation: `minimal` or `notion`
- data/research: `editorial-infographic` or `scientific`
- technical systems: `blueprint`
- education/personal narrative: `sketch-notes`
- culture/aesthetics: `chinese-elegance`

Lock the same background, palette, line weight, typography, grid, corner radius, and icon language across every prompt. Each image must express one point, use generous whitespace, contain at most 1-3 short labels, and contain no logo, watermark, page number, photorealistic filler, or complex gradient.

## Phase 3: generate, verify, upload

For each selected position in article order:

1. Assemble a complete prompt using bundled image-studio's article-logic type, chosen style, base template, and the section's core point.
2. Repeat the full shared visual identity in every prompt; do not assume session memory.
3. Call Codex's built-in `image_gen` once for each distinct image. Express 16:9 composition and 2K-quality intent in every prompt; do not invent CLI flags or call a script.
4. Inspect every returned image, then copy the accepted saved result into a writable project directory. Verify that the copied file exists, is readable, and is a non-empty raster image. Record failures and continue.
5. Upload only verified accepted images with `cowrite_upload_asset`.

## Phase 4: revision-safe insertion

1. Re-read the latest page after generation and upload.
2. Confirm every exact anchor still exists once. Skip missing or ambiguous anchors.
3. Insert from the bottommost anchor toward the top so earlier insertions do not disturb later placement.
4. Use `cowrite_insert_after` with the latest returned revision each time.
5. Markdown format: `![文章配图 01：段落标题](url)`. Number by original article order even though insertion executes in reverse.
6. On a revision conflict, re-read and retry once. Never replace the full article merely to add images.

Return the number of planned, generated, inserted, skipped, and failed images, plus concise failure reasons.
