# AI 图像模式（可选）

仅在满足以下两个条件时启用：用户明确想要插画感/手绘感的**图片式**幻灯片，且环境变量 `LABNANA_API_KEY` 可用（或 `.labnana.env` 存在）。否则一律走默认 HTML 模式。

## 与 HTML 模式的差异

| | HTML 模式（默认） | 图像模式 |
|---|---|---|
| 品牌还原 | 精确 token，像素级 | 由 prompt 描述，近似 |
| 文字 | 精准可编辑 | 可能出错，页内文字要少 |
| 依赖 | 无 | LabNana API key |
| 适合 | 商务/技术/数据内容 | 故事、教育插画、氛围向内容 |

## 流程

1. 正常完成 SKILL.md 的 Step 1-4（分析、风格决策、拉 DESIGN.md、大纲）
2. 为每页写图像 prompt，存 `prompts/NN-slide-{slug}.md`。prompt 必须自包含：
   - 开头声明:"16:9 presentation slide, {品牌} brand design style"
   - 将 design-tokens.md 中的颜色（写 hex 值）、字体气质、留白程度、装饰母题翻译成英文视觉描述
   - 页面文字逐字给出并加引号，越少越好（标题 + 最多 3 个短语）
   - 描述布局（"large centered headline, small caption bottom-left"）
3. 逐页生成：

```bash
python3 <SKILL_DIR>/scripts/generate_slide.py --prompt "$(cat prompts/01-slide-cover.md)" --output design-slide/{topic-slug}/01-slide-cover.png
```

4. 检查每张图的文字是否正确，错误则重生成该页（最多重试 2 次，仍失败就简化该页文字）
5. 用 `export_deck.py --from-images` 把 PNG 合成 pptx/pdf：

```bash
python3 <SKILL_DIR>/scripts/export_deck.py design-slide/{topic-slug} --from-images --pptx design-slide/{topic-slug}/{topic-slug}.pptx
```
