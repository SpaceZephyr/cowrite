---
name: image-studio
description: Generate Cowrite article illustrations, Xiaohongshu images, presentation visuals, covers, and structured diagrams with Codex's built-in image_gen tool. Use for 配图, 整篇配图, 小红书图片, PPT 图片, 封面, 逻辑图, 流程图, 架构图, or any Cowrite task that needs raster image generation.
---

# Image Studio

Create polished raster images with Codex's built-in `image_gen` tool. Never call LabNana, Gemini, OpenAI API/CLI, a local generation script, or any other external image provider. Do not require or request an API key.

If the runtime does not expose the built-in `image_gen` tool, stop and explain that image generation requires Codex with built-in image generation. Do not silently downgrade or insert a placeholder.

## Image types

| Type | Default ratio | Reference |
|---|---:|---|
| Xiaohongshu cover or series | 3:4 | `references/types/xhs-cover.md` |
| Presentation visual | 16:9 | `references/types/ppt-illustration.md` |
| Structured chart or diagram | adaptive | `references/types/chart.md` |
| Article logic illustration | 16:9 | `references/types/article-logic.md` |

Read the matching type reference before prompting. For style, select one file from `references/styles/` and keep its palette, typography, spacing, and visual language intact.

## Confirmation rules

Confirm these four decisions before generation:

1. image type and aspect ratio;
2. complete content and required exact text;
3. one visual style;
4. automatic generation or prompt review first.

Treat a Cowrite command that explicitly lists these confirmed values as confirmation already completed. Do not ask again.

## Prompt assembly

Read `references/prompt-templates/base.md`. Build a concise production prompt containing:

- use case and intended placement;
- exact aspect ratio and composition;
- selected style with complete palette and visual identity;
- one core idea and no more than 3-6 essential concepts;
- exact visible text, kept short and primarily Simplified Chinese;
- no logo, watermark, signature, page number, fake UI text, or decorative filler.

For a multi-image set, repeat the complete shared visual identity in every prompt. Do not assume the image model remembers an earlier call.

## Built-in generation workflow

1. Call Codex's built-in `image_gen` tool directly. For a brand-new image, do not pass reference-image parameters.
2. Generate one distinct asset per tool call. A batch request means repeated built-in calls, not an API or CLI batch script.
3. For later images that must match an earlier generated image, use the first accepted image as a style reference only when the built-in tool and current context support it. Still repeat the full visual identity in the prompt.
4. Inspect every result for composition, text accuracy, palette, watermark, cropping, and consistency. Retry once with one targeted correction when necessary.
5. For a project-bound image, use the tool's saved output path or output hint, then copy or move the accepted image from Codex's generated-images area into a writable project directory. Never leave a referenced project asset only under the default Codex output directory.
6. Never overwrite an existing asset unless explicitly requested. Use stable numbered filenames or a version suffix.

The built-in tool controls the actual raster dimensions. Express 16:9, 3:4, 2K-quality intent, and other layout constraints in the prompt; do not invent unsupported tool arguments.

## Cowrite insertion workflow

For a Cowrite task:

1. Read the latest page and revision before planning.
2. Generate and inspect the requested image or image set with built-in `image_gen`.
3. Copy accepted results into a local writable project directory.
4. Upload only accepted final images with `cowrite_upload_asset`.
5. Re-read the page and confirm every exact anchor.
6. Insert with `cowrite_insert_after` and the latest revision. For multiple anchors, insert from bottom to top while preserving article-order numbering.
7. Never rewrite unrelated text, upload prompts, or insert failed images.

## Design principles

- One image, one idea.
- Structure before decoration.
- Generous whitespace.
- Correct, minimal Chinese text.
- A single coherent style per series.
- No AI clichés, unnecessary icons, fake product logos, or unexplained visual noise.
