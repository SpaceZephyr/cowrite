# HTML 幻灯片制作规范

每页幻灯片是一个独立 HTML 文件，固定 1280×720（16:9）。生成第一页前通读本文件。

## 页面骨架

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<!-- 按品牌 DESIGN.md 指定字体；不可用时按 token 记录的回退字体 -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 720px; overflow: hidden; }
  body {
    /* ↓ 全部来自 design-tokens.md，写具体数值 */
    background: /* token: 背景 */;
    color: /* token: 文字主色 */;
    font-family: /* token: 字体 */;
    display: flex;
  }
  .slide { width: 1280px; height: 720px; padding: 64px 80px; /* padding 也按品牌间距 token 调整 */ }
</style>
</head>
<body>
  <div class="slide"> ... </div>
</body>
</html>
```

## 铁律

1. **固定画布**：1280×720，`overflow: hidden`。任何内容不得溢出——生成后自查文字量，宁可删字不可缩到 12px 以下。
2. **token 即法律**：颜色、字号、字重、行高、圆角、阴影全部使用 design-tokens.md 中的具体值。不确定的值宁可留白（少装饰），不要编造与品牌无关的样式。
3. **正文字号下限 18px**，注释/来源可 13-14px。标题层级：封面主标题 56-88px，内容页标题 36-48px。
4. **不放页脚**：无页码、无 logo 水印（合成 deck 时统一加页码指示器）。
5. **一页一个观点**：每页视觉焦点只有一个（大标题 / 大数字 / 图表 / 对比）。
6. **图表用纯 CSS/SVG 内联绘制**（柱状用 div 高度、折线趋势用 SVG path、占比用 conic-gradient），颜色取品牌强调色系。不引入 Chart.js 等外部库，不留图片占位符。
7. **图片策略**：默认不使用外链图片（会挂）。需要"摄影感"的品牌（Tesla/Nike/Airbnb）用大面积色块 + 渐变 + 排版营造氛围，或使用 CSS 渐变模拟。
8. **中文排版**：中文正文行高 1.6-1.8；中英文混排时英文和数字用品牌英文字体，中文回退到 `"PingFang SC", "Noto Sans SC", "Microsoft YaHei"`（衬线品牌用 `"Noto Serif SC", "Songti SC"`）。

## 布局模板（按页选用）

| 布局 | 结构 | 适用 |
|---|---|---|
| `title-hero` | 垂直居中大标题 + 副标题 + 品牌强调色细节 | 封面、章节页 |
| `key-stat` | 超大数字（120-200px）为焦点 + 一行解释 | 关键指标 |
| `two-column` / `three-column` | 等宽卡片列，卡片样式按品牌组件规范 | 并列要点、对比 |
| `split-screen` | 左文右视觉（或反之），55/45 分割 | 功能亮点 |
| `quote-callout` | 大引号 + 居中引文 + 署名 | 引言、用户声音 |
| `timeline` | 水平节点线 + 里程碑卡片 | 路线图、历程 |
| `icon-grid` | 2×2 / 2×3 网格 + 简单 SVG 图标 + 标签 | 功能清单 |
| `chart-focus` | 图表占 60% + 结论标题 | 数据论证 |
| `agenda` | 大号编号列表 | 目录、议程 |
| `closing` | 行动号召大字 + 联系方式/下一步 | 封底 |

同一 deck 内布局要有节奏变化（连续 3 页以上同布局会单调），但视觉语言（圆角、间距、强调色用法）必须全程一致。

## 品牌气质落地要点

拿到 token 后，问自己三个问题再动手：

- **留白多少？** Apple/Linear/Tesla 类：内容占比 <60%，敢于空。Binance/ClickHouse 类：信息密度高是特色。
- **对比多强？** Nike/NVIDIA：极端对比大字。Notion/Clay：柔和低对比。
- **装饰是什么？** 每个品牌有标志性装饰语言——Stripe 的斜切渐变条、Linear 的微光边框、Vercel 的三角与细网格、Miro 的手绘下划线。找到 DESIGN.md 里的组件样式，把它变成幻灯片的装饰母题，全 deck 重复使用。

## 自查清单（每页生成后）

- [ ] 无溢出（内容都在 1280×720 内）
- [ ] 颜色/字体值与 design-tokens.md 一致
- [ ] 标题是叙事句而非标签
- [ ] 视觉焦点唯一
- [ ] 与前一页视觉语言一致
