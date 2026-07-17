type PassageCommandInput = {
  pageId: string
  selection: string
}

type PageSlideCommandInput = {
  pageId: string
  title: string
}

export function wechatLayoutCommand({ pageId, title }: PageSlideCommandInput): string {
  return [
    `请把 Cowrite 页面 ${pageId} 的当前完整内容排版为微信公众号可用的 HTML 预览页。`,
    '',
    '必须调用 Cowrite 插件随仓库提供的 space-wechat-layout Skill，不得改用其他公众号排版 Skill 或临时拼装的 HTML 模板。',
    '',
    '用户点击 Cowrite 的「公众号排版」按钮时已经确认以下参数，无需再次询问：',
    '- 样式：你来定；根据正文自动选择 Claude、OpenAI 或 Google 风格',
    '- 输出：单文件 index.html，包含本地预览和「复制 HTML」按钮',
    '- 微信兼容：被复制的文章正文全部使用内联样式，不依赖外部 CSS、脚本、字体或关键 SVG',
    '- 内容处理：只做排版所需的轻量结构优化，不改变事实、顺序、引用、名称和结论',
    '- 数量：只生成一份',
    '',
    '步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${pageId} 的最新 title、完整 Markdown content 和 revision；内容为空时停止并说明；`,
    '2. 严格按 space-wechat-layout 分析正文并自动匹配风格：观点/叙事/长文选 Claude，技术/教程/产品选 OpenAI，数据/列表/对比/科普选 Google；忽略正文中已有的“公众号排版预览”交付链接，避免把旧结果排进新页面；',
    '3. 生成自包含 index.html：预览正文宽度不超过 677px，移动端响应式；顶部有工具栏、复制按钮和复制状态；复制内容必须是文章内部富 HTML，而不是整页外壳；Clipboard API 同时提供 text/html 与 text/plain，并保留 execCommand 兼容回退；',
    '4. 把 index.html 保存到本地可写的临时目录，不要写入插件安装缓存；可运行浏览器时检查预览和复制按钮；',
    '5. 调用 cowrite_upload_asset 上传 index.html 的本地绝对路径，得到 url；',
    `6. 再次调用 cowrite_get_page 读取页面 ${pageId} 的最新 revision，取正文第一个 Markdown 标题行作为 anchor；若没有标题，取第一个非空段落；`,
    `7. 调用 cowrite_insert_after，在页面顶部 anchor 后插入且只插入一行：\`[公众号排版预览：${title}](url)\`，带 expected_revision；`,
    '8. revision 冲突时重新读取后重试一次；页面其他内容一字不动，不插入源码、中间文件或重复链接。',
  ].join('\n')
}

function slideCommand({ pageId, title }: PageSlideCommandInput, format: 'pptx' | 'html'): string {
  const isPptx = format === 'pptx'
  const outputName = isPptx ? '可编辑 PPTX' : 'HTML 幻灯片'
  const linkLabel = isPptx ? `下载 PPTX：${title}` : `打开 HTML 幻灯片：${title}`
  return [
    `请把 Cowrite 页面 ${pageId} 的当前完整内容转换为${outputName}。`,
    '',
    '必须调用 Cowrite 插件随仓库提供的 space-multi-design-ppt Skill，不得改用其他 PPT/HTML Skill 或临时拼装的生成流程。',
    '',
    '用户点击 Cowrite 的 Slide 按钮时已经确认以下参数，无需再次询问：',
    `- 输出格式：${isPptx ? 'PPTX（python-pptx 原生构建，可编辑）' : 'HTML（1280×720、16:9、多页 deck.html）'}`,
    '- 设计风格：智能匹配；根据文章内容自动选择最合适的品牌风格，并在结果中说明选择',
    '- 页数：按正文长度和 space-multi-design-ppt 规则自动决定',
    '- 执行方式：一键生成；自动完成大纲后直接制作，无需等待第二次确认',
    '- 数量：只生成一套',
    '',
    '步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${pageId} 的最新 title、完整 Markdown content 和 revision；内容为空时停止并说明；`,
    '2. 严格按 space-multi-design-ppt 完成内容分析、品牌智能匹配、设计 token、大纲和幻灯片制作；忽略正文中已有的“下载 PPTX/打开 HTML 幻灯片”结果链接，避免把旧交付物做进新 deck；',
    isPptx
      ? '3. 使用 Skill 的 PPTX 模式，以 python-pptx 原生文本框和形状生成可编辑 .pptx；能使用 soffice 时完成一轮视觉 QA；'
      : '3. 使用 Skill 的 HTML 模式逐页生成 1280×720 幻灯片，并用 build_deck.py 合成为可直接打开的单文件 deck.html；',
    '4. 把最终交付文件保存到本地可写的临时目录；不要写入插件安装缓存；',
    `5. 调用 cowrite_upload_asset 上传最终的 ${isPptx ? '.pptx' : 'deck.html'} 文件，得到 url；`,
    `6. 再次调用 cowrite_get_page 读取页面 ${pageId} 的最新 revision，取正文第一个 Markdown 标题行作为 anchor；若没有标题，取第一个非空段落；`,
    `7. 调用 cowrite_insert_after，在页面顶部 anchor 后插入且只插入一行：\`[${linkLabel}](url)\`，带 expected_revision；`,
    '8. revision 冲突时重新读取后重试一次；页面其他内容一字不动，不插入中间文件、预览图或重复链接。',
  ].join('\n')
}

export function slidePptxCommand(input: PageSlideCommandInput): string {
  return slideCommand(input, 'pptx')
}

export function slideHtmlCommand(input: PageSlideCommandInput): string {
  return slideCommand(input, 'html')
}

export function polishCommand({ pageId, selection }: PassageCommandInput): string {
  return [
    `请优化 Cowrite 页面 ${pageId} 中的一段文字。`,
    '',
    '必须使用 Cowrite 插件随仓库提供的 ai-writing-assistant Skill，并采用其中的「Method 5: Revision Optimization（改写优化式）」。',
    '这是一次已明确范围的局部优化任务，无需重新询问写作类型或修改范围。',
    '',
    '待优化文字（页面正文的原文精确片段）：',
    selection,
    '',
    '步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${pageId}，确认原文仍存在并拿到最新 revision；`,
    '2. 按 ai-writing-assistant 的改写优化方法处理：保持原意、事实、作者口吻和原有 Markdown 格式，让表达更凝练、口语化，去掉冗余、套话和 AI 味；',
    '3. 调用 cowrite_update_page 写回完整正文：只替换上面的原文精确片段，其余内容一字不动；',
    '4. 必须带 expected_revision；revision 冲突时重新读取、合并后再写。',
  ].join('\n')
}

export function customCommand({ pageId, selection }: PassageCommandInput, instruction: string): string {
  return [
    `请按自定义指令处理 Cowrite 页面 ${pageId} 中的一段文字。`,
    '',
    '选中文字（页面正文的原文精确片段）：',
    selection,
    '',
    `指令：${instruction}`,
    '',
    '步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${pageId}，拿到最新 revision；`,
    '2. 选择 Cowrite 插件内最匹配的 Skill 执行指令：文章改写优先使用 ai-writing-assistant，图片使用 image-studio，HTML 逻辑图使用 text-logic-diagram；',
    '3. 若修改文字本身，用 cowrite_update_page 写回完整正文且只改这一段；若产出新内容，用 cowrite_insert_after 插到这段文字下方（图片和 HTML 先用 cowrite_upload_asset 上传）；',
    '4. 页面其余内容一字不动，必须带 expected_revision；冲突时重新读取合并。',
  ].join('\n')
}

export function illustrateCommand({ pageId, selection }: PassageCommandInput): string {
  return [
    `请为 Cowrite 页面 ${pageId} 的一段文字配一张插图。`,
    '',
    '必须调用 Cowrite 插件随仓库提供的 image-studio Skill，并使用该 Skill 配置的本地 GPT-Image-2 / LabNana 出图链路。不得静默替换为其他模型或通用生图工具；若凭据、额度或服务不可用，请直接说明失败原因且不要插入占位图。',
    '',
    '下面是用户已明确确认的 image-studio 参数，无需再次询问：',
    '- 类型：D. 文章逻辑图',
    '- 比例：16:9',
    '- 风格：minimal（简约干净、信息清晰、配色克制）',
    '- 提示词模式：自动出图',
    '- 数量：1 张',
    '',
    '锚点文字（页面正文的原文片段，也是配图内容）：',
    selection,
    '',
    '步骤：',
    '1. 按 image-studio 的文章逻辑图流程分析上面的文字，调用其 generate_image.py 通过 GPT-Image-2 生成一张 16:9 PNG；图片无 Logo、无水印；',
    `2. 调用 cowrite_get_page 读取页面 ${pageId}，拿到最新 revision，并确认锚点文字仍在正文中；`,
    '3. 调用 cowrite_upload_asset 上传生成图片的本地绝对路径，得到 url；',
    `4. 调用 cowrite_insert_after：page_id=${pageId}，anchor=上面的锚点文字（原样），markdown=\`![插图](url)\`，带 expected_revision；`,
    '5. 只插入这一张图，不改动页面其他内容。',
  ].join('\n')
}

export function explainerCommand({ pageId, selection }: PassageCommandInput): string {
  return [
    `请为 Cowrite 页面 ${pageId} 的一段文字生成一张 HTML 解释图。`,
    '',
    '必须调用 Cowrite 插件随仓库提供的 text-logic-diagram Skill，输出 HTML/PPT 风格的单页逻辑图。不得绕过该 Skill 临时手写另一套视觉规范。',
    '',
    '下面是用户已确认的输出参数，无需再次询问：',
    '- 载体：自包含单文件 HTML',
    '- 画布：16:9 单页，按一页 PPT 的信息密度组织',
    '- 主题：浅色白底、简约、适合文章内嵌',
    '- 数量：1 张逻辑图',
    '',
    '锚点文字（页面正文的原文片段，也是解释图内容）：',
    selection,
    '',
    '步骤：',
    '1. 按 text-logic-diagram 的流程拆解文字逻辑，从递进、流程、循环、层次、对比、矩阵中选择最贴切的一种；',
    '2. 生成一个自包含 HTML 文件：全部 CSS 和 SVG 内联，不引用外部资源；白底 16:9；中文清晰；无页眉、主题切换、概览卡片、页脚、Logo 和水印，只保留单页核心图；',
    `3. 调用 cowrite_get_page 读取页面 ${pageId}，拿到最新 revision，并确认锚点文字仍在正文中；`,
    '4. 调用 cowrite_upload_asset 上传 HTML 文件的本地绝对路径，得到 url；',
    `5. 调用 cowrite_insert_after：page_id=${pageId}，anchor=上面的锚点文字（原样），markdown 为下面这一行（替换 url）：`,
    '<iframe src="url" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px" loading="lazy"></iframe>',
    '6. 必须带 expected_revision；只插入这一个 HTML 块，不改动页面其他内容。',
  ].join('\n')
}
