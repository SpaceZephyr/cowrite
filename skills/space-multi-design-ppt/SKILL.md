---
name: space-multi-design-ppt
description: 品牌设计风格驱动的幻灯片生成器。将用户内容智能匹配到 62 个顶级品牌设计系统（Apple、Notion、Claude、Stripe、Linear、Tesla 等），拉取真实品牌设计规范（DESIGN.md）后生成像素级还原品牌风格的 HTML 幻灯片，或用 python-pptx 原生构建可编辑 PPTX（制作前会询问用户要哪种输出）。用户要求"做 PPT"、"做个 slide"、"生成演示文稿"、"design slide"、"用 XX 风格做幻灯片"、"把这篇文章做成 deck"、"输出 pptx"、提到 presentation/keynote/路演/汇报材料，或发来一段内容希望变成幻灯片时，都应使用本 skill——即使用户没有提到"品牌"或"设计风格"。
---

# Space Multi Design PPT

把任意内容变成带顶级品牌设计语言的幻灯片。核心思路：不靠凭空发挥的"好看"，而是通过 getdesign.md 拉取 62 个真实品牌的精确设计规范（颜色、字体、间距、圆角、阴影的具体数值），用这些 token 驱动 HTML 幻灯片渲染，保证风格可信且一致。

## 工作流总览

```
进度清单（逐项勾选）：
- [ ] Step 1: 接收并分析内容
- [ ] Step 2: 风格决策 + 输出格式确认（HTML / PPTX）⚠️ 必须
- [ ] Step 3: 拉取品牌 DESIGN.md 并提取设计 token
- [ ] Step 4: 生成大纲（简短确认）
- [ ] Step 5A（HTML 模式）: 逐页生成 HTML → 合成 deck.html
- [ ] Step 5B（PPTX 模式）: python-pptx 原生构建 → soffice 渲染 QA
- [ ] Step 6: 交付与总结
```

**语言规则**：所有与用户的交流、幻灯片文案语言跟随用户输入语言（用户中文则全中文，技术名词和品牌名保留英文）。

## Step 1: 接收并分析内容

内容可能是：粘贴的文字、文件（md/docx/pdf/txt）、或一个主题（"帮我做一个关于 XX 的 PPT"）。

1. 若是文件，读取内容；若只是主题，先与用户确认要点或自行调研补全内容
2. 分析内容，得出：
   - **核心信息**（一句话）与 3-5 个支撑点
   - **受众**（高管/技术/大众/投资人/学习者）
   - **内容信号**（用于风格匹配，见 Step 2）
   - **建议页数**：<1000 字 → 5-8 页；1000-3000 字 → 8-15 页；>3000 字 → 12-20 页
3. 深度分析方法见 `references/outline-guide.md`（信息层级、受众适配、视觉机会点）

## Step 2: 风格决策 + 输出格式确认 ⚠️ 必须

### 输出格式：制作前必须问用户

除非用户已明确说了要什么格式（"做个 PPT 文件"、"输出 pptx"、"给我 HTML"），否则在开始制作前询问（可与风格推荐合并为一条消息）：

| 选项 | 特点 | 适合 |
|---|---|---|
| **HTML 幻灯片** | 品牌还原像素级精确（渐变/字体/细节最佳），浏览器全屏演示，单文件分享 | 线上演示、追求视觉效果 |
| **PPTX** | 原生可编辑（真实文本框与形状，可改字换色），兼容 PowerPoint/Keynote/WPS | 需要二次编辑、正式商务场合、他人接手 |
| 两者都要 | 先做 HTML 定稿，再产 PPTX | 不确定时的稳妥选择 |

用户说"都要"时按 HTML → PPTX 顺序做，内容定稿一次、渲染两次。

### 情况 A：用户已指定风格 → 直接用，跳过推荐

用户说"用 Stripe 风格"、"做成苹果的感觉"、"Notion 那种"时，对照 `references/brand-registry.md` 找到 slug，直接进入 Step 3。支持混搭（"Notion 配色 + Linear 排版"→ 两个 slug 都拉取）。

### 情况 B：用户未指定 → 展示 5+1 推荐

根据 Step 1 的内容信号，从 `references/brand-registry.md` 的匹配标签中选出 **5 个与内容最匹配的品牌风格**，在聊天中展示给用户（每个一句话介绍），并附上第 6 项「智能匹配」：

```
根据你的内容，我推荐以下设计风格：

1. **Stripe** — 紫色渐变 + 300 字重优雅排版，金融科技质感
2. **Linear** — 超级极简 + 精准间距 + 紫色点缀，效率工具气质
3. **Vercel** — 黑白精准 + Geist 字体，开发者极简美学
4. **Notion** — 暖色极简 + 衬线标题，柔和知识感
5. **Claude** — 赭石强调色 + 编辑级排版，温暖智识感

6. **智能匹配** — 我根据内容气质直接选择最合适的风格（含混搭）

回复编号或品牌名即可，也可以直接说其他品牌（共支持 62 个）。
```

要求：
- 5 个推荐必须**真的和内容匹配**（科技产品内容别推 Ferrari，儿童教育内容别推 Binance），依据 registry 中每个品牌的匹配标签
- 一句话介绍用 registry 中的风格描述，突出"选它会得到什么视觉效果"
- 用户选「智能匹配」时，选出最贴合的 1 个品牌（或 2 个混搭），**告知用户选了什么及理由**再继续
- 保持推荐有新鲜感：匹配度接近时可轮换，不要每次都推同样 5 个

## Step 3: 拉取 DESIGN.md 并提取 token

```bash
mkdir -p /tmp/design-md-tmp/<slug> && cd /tmp/design-md-tmp/<slug> && npx -y getdesign@latest add <slug> 2>&1
cat /tmp/design-md-tmp/<slug>/DESIGN.md
```

从 DESIGN.md 提取并记录（建议写入工作目录 `design-tokens.md` 备查）：

- **颜色**：背景 / 表面 / 文字主次 / 强调色 / 边框
- **字体**：font-family、字号层级、字重、行高、字间距（若品牌字体不可用，注明最接近的 Google Fonts / 系统字体回退）
- **间距与圆角**：基础单位、组件 radius
- **阴影**：各层级 box-shadow
- **气质关键词**：留白程度、对比强度、装饰倾向

**严格执行规范里的具体数值**——规范写 `rgba(0,0,0,0.95)` 就不要写 `#000`，字间距 `-2.125px` 就不要四舍五入。这是本 skill 与"随手做个好看 PPT"的本质区别。

混搭时：以主品牌为骨架，从副品牌提取指定维度（颜色/排版/布局）融合，并在 deck 注释中说明来源。

**降级**：npx 失败（无网络/无 Node）时，使用 `references/brand-registry.md` 中该品牌的风格描述作为设计方向，告知用户这是近似还原。

## Step 4: 生成大纲

按 `references/outline-guide.md` 生成 `outline.md`：封面 + 内容页 + 封底，每页标注：标题（叙事式，讲结论不贴标签）、要点、布局类型、视觉元素。

把大纲**简要**展示给用户确认（不用逐字，列出页码+每页标题即可）。用户没意见或说"直接来"就继续；已经确认过一次流程的老用户可跳过。

## Step 5A: HTML 模式 —— 逐页生成 HTML 幻灯片

输出目录结构：

```
design-slide/{topic-slug}/
├── source.md            # 原始内容
├── design-tokens.md     # 提取的品牌 token
├── outline.md
├── slides/              # HTML 模式：每页独立 1280×720
│   ├── 01-cover.html
│   ├── 02-{slug}.html ...
├── deck.html            # HTML 模式交付物
├── build_pptx.py        # PPTX 模式：构建脚本（留档便于改版）
├── {topic-slug}.pptx    # PPTX 模式交付物
└── {topic-slug}.pdf     # 按需
```

每页是独立的 1280×720 HTML。制作规范（尺寸、防溢出、布局模板、token 应用方式）详见 `references/slide-html-guide.md`——**生成第一页前必读**。

内容质量规则（详见 outline-guide）：
- 每页只讲一个观点；标题叙事化（"用量 6 个月翻倍"而非"关键数据"）
- 数据标注来源；禁用占位符；禁 AI 套话（"让我们一起探索"之类）
- 封底不是"谢谢观看"，要有行动号召或记忆点

所有单页完成后，运行合成脚本把 slides/ 打包成带键盘翻页、全屏演示、页码指示的单文件 deck：

```bash
python3 <SKILL_DIR>/scripts/build_deck.py design-slide/{topic-slug}/slides --output design-slide/{topic-slug}/deck.html --title "标题"
```

deck.html 支持：←/→/空格翻页、F 全屏、G 网格总览、URL hash 定位页码。

需要 PDF 时优先用 Chromium 截图路线（`scripts/export_deck.py --pdf`，依赖 playwright）；装不上就建议用户浏览器打印。

## Step 5B: PPTX 模式 —— python-pptx 原生构建

**必读 `references/pptx-native-guide.md`** 再动手。核心原则：

- **原生优先**：用 python-pptx 直接构建文本框和形状（用户可二次编辑），不要走"HTML 截图贴入 PPT"的路线——那需要 Chromium（沙盒里经常装不上），且产物不可编辑
- token 映射：px→pt 乘 0.75；颜色/圆角/间距沿用 design-tokens.md；品牌渐变背景用 PIL 预生成 PNG 插入
- 字体安全：正文用 Calibri/Arial 等 Office 自带字体，大标题可用 Calibri Light；中文必须显式设置 ea 字体（微软雅黑）
- **视觉 QA 必做**：soffice 转 PDF → pdftoppm 转图 → 逐页查看，修掉溢出/重叠/贴边后再交付（一轮修复即可，不无限迭代）

## Step 6: 交付

展示交付文件（deck.html 和/或 .pptx），总结：使用的品牌风格及关键 token、页数、如何使用（HTML：打开按 F 全屏；PPTX：可直接在 PowerPoint 编辑）。询问是否需要：调整个别页、换风格重渲染（token 换掉、结构复用）、补另一种格式。

## Cowrite 一键 Slide 模式

当任务来自 Cowrite 顶部的 Slide 按钮，并给出页面 ID、已确认的输出格式与“智能匹配”风格时：

1. 视为 Step 2 的格式和风格确认已经完成，不要重复询问
2. 用户已授权一键生成：自动生成大纲后直接制作，不再暂停等待大纲确认
3. 用 `cowrite_get_page` 读取当前完整 Markdown，忽略已有的 Slide 结果链接
4. HTML 输出最终只上传 `deck.html`；PPTX 输出最终只上传 `.pptx`
5. 中间文件必须写入本地临时可写目录，不要写入插件安装缓存
6. 用 `cowrite_upload_asset` 上传最终文件，再重新读取页面 revision
7. 用 `cowrite_insert_after` 把最终地址作为 Markdown 链接插到第一个标题后
8. 只插入一条交付链接，页面原内容一字不动；revision 冲突时重新读取后重试一次

## 可选：AI 图像模式

用户明确要"插画感/手绘感的图片幻灯片"且当前运行时提供 Codex 内置 `image_gen` 工具时，走图像生成管线：见 `references/image-mode.md`。默认**不**走此模式，HTML 模式文字精准且可编辑。不得调用外部图片 API 或 CLI。

## 错误处理速查

| 问题 | 处理 |
|---|---|
| npx getdesign 失败 | 用 registry 风格描述近似还原，告知用户 |
| 品牌不在 62 个之内 | 列出最接近的 3 个替代品牌让用户选 |
| 要 PPTX 但 playwright/Chromium 装不上 | 无影响 —— PPTX 走 python-pptx 原生构建，不依赖浏览器 |
| soffice 不可用（PPTX QA） | 跳过渲染 QA，靠坐标自查（盒子尺寸留 10% 余量），并告知用户建议自查 |
| 内容太长（>5000 字） | 建议拆成多个 deck 或聚焦一条主线 |
| 品牌字体无法加载 | 用 registry/DESIGN.md 中的回退字体，注释说明 |
