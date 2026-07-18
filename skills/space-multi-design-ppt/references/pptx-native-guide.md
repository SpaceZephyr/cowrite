# PPTX 原生构建规范（python-pptx）

PPTX 模式的产物必须是**可编辑的原生 PPT**：真实文本框、形状、图片，用户能在 PowerPoint 里改字换色。不要用"HTML 截图贴图"——依赖 Chromium（沙盒常装不上）且不可编辑。

依赖：`pip install python-pptx Pillow --break-system-packages`（均为纯 Python，无浏览器依赖）。

## 画布与 token 映射

- 幻灯片：`prs.slide_width = Inches(13.333)`、`prs.slide_height = Inches(7.5)`（16:9），用空白版式 `slide_layouts[6]`
- 换算：HTML 设计稿按 96px/in —— **px→in 除以 96；px→pt 乘 0.75**。80px 边距 = 0.83in；56px 标题 = 42pt
- 颜色/圆角/间距全部沿用 design-tokens.md 的值；圆角矩形用 `MSO_SHAPE.ROUNDED_RECTANGLE` + `shape.adjustments[0]` 控制弧度（0.05≈12px 卡片，0.5=pill 全圆）
- 所有形状设 `shape.shadow.inherit = False`，否则 LibreOffice/旧版 Office 可能渲染默认阴影

## 字体（最容易翻车的地方）

- **正文用 Office 自带安全字体**：Calibri / Arial；大标题可用 Calibri Light 模拟品牌细字重（预留 ~10% 宽度余量）。不要写品牌专有字体名（Sohne/Copernicus 等用户机器上没有）
- **中文必须显式设置 East Asian 字体**，python-pptx 的 `font.name` 只设 latin。写 XML：

```python
from pptx.oxml.ns import qn
def set_run(run, text, size, color, font='Calibri', ea='Microsoft YaHei'):
    run.text = text; run.font.size = Pt(size); run.font.color.rgb = color; run.font.name = font
    rPr = run._r.get_or_add_rPr()
    for tag, tf_ in (('a:latin', font), ('a:ea', ea)):
        e = rPr.find(qn(tag))
        if e is None: e = rPr.makeelement(qn(tag), {}); rPr.append(e)
        e.set('typeface', tf_)
```

- 衬线品牌（Notion/Claude 标题）：latin 用 Cambria / Century Schoolbook，ea 用宋体/Noto Serif 名称
- 字间距：`rPr.set('spc', '-100')`（单位 1/100 pt）近似品牌负字距

## 品牌装饰母题

- **渐变 mesh / 复杂背景用 PIL 预生成 PNG** 再 `add_picture` 全宽插入。径向渐变叠加法：`Image.radial_gradient('L')` 反相做 alpha → 多个色块 paste → `GaussianBlur(60)` → 底部叠白色线性渐变收边。**注意 `Image.linear_gradient('L')` 是上黑(0)下白(255)**——渐隐方向搞反会出现生硬色边（本 skill 踩过的坑）
- 简单装饰（细线、色带、圆点）直接用形状：`add_connector` 画发丝线（`Pt(0.75)`），小圆 `MSO_SHAPE.OVAL`
- 文本框归零内边距（`margin_left/right/top/bottom = 0`），否则与形状对不齐

## 布局纪律

- 边距 ≥0.83in；卡片间距统一（0.15-0.25in）
- 每页写完后心算内容高度，文字盒高度留 10-15% 余量防溢出（中文换行比估算多）
- 与 HTML 版同一大纲、同一文案，只换渲染层

## 视觉 QA（必做）

```bash
soffice --headless --convert-to pdf --outdir /tmp/qa out.pptx
pdftoppm -jpeg -r 100 /tmp/qa/out.pdf /tmp/qa/slide
# 把 jpg 拷到可读目录，逐页查看
```

检查：文字溢出/截断、元素重叠、间距失衡、低对比、渐变色边。**修一轮、复查受影响页、停**——不要为像素级微调无限迭代。沙盒里后台进程不跨调用存活，所有命令要在单次调用内完成。

通过 QA 后保留这份由最终 PPTX 转换出的 PDF。Cowrite 交付时上传 PDF 作为浏览器预览，同时上传 PPTX 作为可编辑源文件；不得用旧版 QA PDF 或截图版 deck 冒充预览。
