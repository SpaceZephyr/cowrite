type PassageCommandInput = {
  pageId: string
  selection: string
}

type PageSlideCommandInput = {
  pageId: string
  title: string
}

type PageCreationCommandInput = PageSlideCommandInput & {
  content: string
}

export function pageCreationCommand({ pageId, title, content }: PageCreationCommandInput, requirement: string): string {
  return [
    `请根据 Cowrite 页面 ${pageId} 的当前完整内容继续创作。`,
    '',
    `页面标题：${title}`,
    `创作要求：${requirement}`,
    '',
    '当前页面 Markdown（创作上下文）：',
    '<cowrite-page-content>',
    content,
    '</cowrite-page-content>',
    '',
    '执行规则：',
    `1. 上面的 Markdown 是用户点击选项时复制的当前页面内容，直接作为本轮创作上下文；写回前调用 cowrite_get_page 读取页面 ${pageId} 的最新 title、完整 Markdown content 和 revision；`,
    '2. 选择 Cowrite 插件内与创作要求最匹配的 Skill；保持页面已有事实、作者口吻和 Markdown 结构；',
    '3. 若要求是续写、补充或生成衍生内容，把新内容自然追加到当前正文；若明确要求改写或替换，才修改对应内容；不要无故删除原文；',
    '4. 调用 cowrite_update_page 写回完整正文，必须带 expected_revision；',
    '5. revision 冲突时重新读取，合并用户最新修改后重试一次。',
  ].join('\n')
}

export function larkSendCommand({ pageId, title, content }: PageCreationCommandInput): string {
  return [
    '请把下面的 Cowrite 本地 Markdown 内容发送为一篇新的飞书云文档。',
    '',
    `Cowrite 页面：${pageId}`,
    `文档标题：${title}`,
    '用户已经在 Cowrite 的发送确认界面明确确认创建飞书文档，无需再次询问是否发送。',
    '',
    '待发送的当前页面 Markdown：',
    '<cowrite-page-content>',
    content,
    '</cowrite-page-content>',
    '',
    '执行要求：',
    '1. 必须使用本机 lark-cli 和已安装的 lark-doc Skill；先完整读取 lark-doc Skill 及其要求的 lark-shared、lark-doc-md 和创建流程说明；',
    '2. 检查 lark-cli 是否可用及 user 身份认证状态。若尚未配置或授权，严格按 lark-shared 的 split-flow 发起最小权限授权，把原始授权 URL 和二维码交给用户，然后暂停等待用户完成；不得输出任何密钥；',
    '3. 保持上面的 Markdown 标题、正文、链接、图片和顺序，不做改写；若正文没有一级标题，在临时副本顶部补充文档标题；',
    '4. 将最终 Markdown 安全保存到本地临时 .md 文件，使用文件传参避免 shell 转义或命令替换；',
    '5. 执行 `lark-cli docs +create --api-version v2 --as user --doc-format markdown --content @<临时文件绝对路径>`；只创建一篇文档；',
    '6. 检查返回结果 ok=true，并把 document.url 作为可点击链接返回给用户；失败时说明准确原因，不重复创建，不修改 Cowrite 原页面。',
  ].join('\n')
}

export function articleIllustrationCommand({ pageId, title, content }: PageCreationCommandInput): string {
  return [
    `请为 Cowrite 页面 ${pageId} 的整篇文章生成并插入一组配图。`,
    '',
    `页面标题：${title}`,
    '用户已在 Cowrite 的整篇配图确认界面确认以下参数，无需再次询问：',
    '- 规划：使用 Cowrite 插件内置 article-batch-illustration Skill 分析全文和插图位置',
    '- 出图：使用同一插件内置 image-studio Skill，直接调用 Codex 内置 image_gen 工具生成图片',
    '- 类型：D. 文章逻辑图；16:9；高清质量意图；中文为主；无 Logo、无水印',
    '- 风格：根据全文自动选择最合适的一种风格，整组图片保持统一视觉身份',
    '- 数量：按文章结构自动决定 2-6 张；短文可少于 2 张，不为凑数而配图',
    '- 提示词：自动生成并直接出图',
    '',
    '点击时的页面 Markdown（仅作初始分析上下文）：',
    '<cowrite-page-content>',
    content,
    '</cowrite-page-content>',
    '',
    '执行步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${pageId} 的最新 title、完整 Markdown content 和 revision；以后者为准，内容为空时停止；忽略正文中已有的“文章配图”图片，避免重复规划；`,
    '2. 严格按 article-batch-illustration Skill 按 H2/H3 和核心段落拆解全文；挑选 2-6 个真正需要视觉解释的位置，每个位置记录一段仍在正文中的、唯一且原样的 Markdown 标题或段落作为 anchor；不要每段都配图；',
    '3. 为所有图片先确定一个统一风格与色板，再为每个位置生成“一图一观点”的独立提示词；图片中文字最多保留 1-3 个中文关键词，专业缩写可用英文；',
    '4. 按文章顺序逐张调用 Codex 内置 image_gen 工具，每张图片一次独立调用；在每份提示词中明确 16:9、高清质量意图和统一视觉身份，不得调用外部 API、CLI、本地生图脚本或其他模型；',
    '5. 检查每张结果的构图、文字、裁切和一致性；使用内置工具返回的保存路径或输出提示，把接受的图片复制到本地可写目录，再逐张调用 cowrite_upload_asset；不上传提示词或中间文件。内置 image_gen 不可用或失败时说明原因，不插入占位图；',
    `6. 再次调用 cowrite_get_page 读取页面 ${pageId} 的最新 content 和 revision，确认所有 anchor 仍存在且位置正确；`,
    '7. 从正文靠后的 anchor 开始，依次调用 cowrite_insert_after 插入 `![文章配图 01：段落标题](url)`；每次都使用上一次返回的最新 revision。编号仍按文章正序 01、02……；',
    '8. 只插入本轮成功生成的图片，不改写、移动或删除页面其他内容；anchor 消失时跳过对应图片，不得猜测插入位置；revision 冲突时重新读取后重试一次。',
  ].join('\n')
}

export function wechatLayoutCommand({ pageId, title }: PageSlideCommandInput): string {
  return [
    `请把 Cowrite 页面 ${pageId} 的当前完整内容排版为微信公众号可用的 HTML 预览页。`,
    '',
    '必须调用 Cowrite 插件随仓库提供的 space-wechat-layout Skill，不得改用其他公众号排版 Skill 或临时拼装的 HTML 模板。',
    '',
    '用户点击 Cowrite 的「排版」按钮时已经确认以下参数，无需再次询问：',
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

export function xhsLayoutCommand({ pageId, title }: PageSlideCommandInput): string {
  return [
    `请把 Cowrite 页面 ${pageId} 的当前完整内容转换为一组小红书图片。`,
    '',
    '必须使用 Cowrite 插件随仓库提供的 baoyu-xhs-images Skill 完成内容分析、三套策略、大纲和视觉规范，并使用同一插件内的 image-studio Skill，通过 Codex 内置 image_gen 工具生成最终图片。不得调用外部图片 API、CLI、本地生图脚本或其他模型；若内置工具不可用或失败，直接说明且不要插入占位图。',
    '',
    '用户已经确认图片生成器，无需再次询问：',
    '- 模型：Codex 内置 image_gen',
    '- 画布：小红书竖版 3:4，高清 PNG',
    '- 数量：由 baoyu-xhs-images 根据全文推荐 2-10 张',
    '- 产物：封面 + 内容页 + 结尾页，只生成一套最终方案',
    '',
    '必须保留 baoyu-xhs-images 的确认流程：',
    '1. 先检查项目级和用户级 EXTEND.md；没有偏好文件时，只执行首次设置并保存后再继续；',
    `2. 调用 cowrite_get_page 读取页面 ${pageId} 的最新 title、完整 Markdown content 和 revision；内容为空时停止；忽略正文中已有的小红书图片结果；`,
    '3. 按 Skill 生成 analysis.md，展示内容理解并完成确认 1；',
    '4. 生成故事驱动、信息密集、视觉优先三套不同策略，展示逐页摘要、风格和元素并完成确认 2；',
    '5. 把确认后的方案写入 outline.md，为每页生成独立提示词；默认 3:4，封面 sparse，中间页按内容选择 balanced/dense/list/comparison/flow，结尾 sparse；',
    '6. 按页顺序逐张调用 Codex 内置 image_gen，每张图片一次独立调用；在每份提示词中重复 3:4 画布、完整色板、字体、人物和装饰规则。工具和当前上下文支持参考图时，可用已接受的封面作为风格参考，不得虚构 CLI 参数；',
    '7. 每生成一张就检查构图、文字和一致性，使用工具返回的保存路径或输出提示把接受结果复制到本地可写目录；全部成功后逐张调用 cowrite_upload_asset，按 01、02…顺序得到 url；',
    `8. 再次调用 cowrite_get_page 读取页面 ${pageId} 的最新 revision，取第一个 Markdown 标题行作为 anchor；若没有标题，取第一个非空段落；`,
    `9. 调用 cowrite_insert_after 一次，在 anchor 后插入一个连续 Markdown 图片组，每张一行：\`![小红书图片 01：${title}](url)\`；带 expected_revision；`,
    '10. revision 冲突时重新读取后重试一次；页面其他内容一字不动，不插入 analysis、outline、prompt 或失败图片。',
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

export function conversationCommand({ pageId, selection }: PassageCommandInput): string {
  const quote = selection.split('\n').map((line) => `> ${line}`).join('\n')
  return [
    `请修改 Cowrite 页面 ${pageId} 中我引用的这段文字。`,
    '',
    '我想这样修改：',
    '【请在发送前把这里替换成你的修改要求】',
    '',
    '引用原文：',
    quote,
    '',
    '步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${pageId}，拿到最新 revision；引用行前的 \`> \` 只是对话格式，去掉后确认原文仍存在；`,
    '2. 按我补充的要求修改引用内容；若修改要求仍是占位文字，先向我确认，不要写回；',
    '3. 调用 cowrite_update_page 写回完整正文，只替换这段引用原文，其余内容一字不动；',
    '4. 必须带 expected_revision；revision 冲突时重新读取、合并后再写。',
  ].join('\n')
}

export function illustrateCommand({ pageId, selection }: PassageCommandInput): string {
  return [
    `请为 Cowrite 页面 ${pageId} 的一段文字配一张插图。`,
    '',
    '必须调用 Cowrite 插件随仓库提供的 image-studio Skill，并直接使用 Codex 内置 image_gen 工具。不得调用 LabNana、Gemini、外部图片 API、CLI、本地生图脚本或其他模型；若内置工具不可用或失败，请直接说明且不要插入占位图。',
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
    '1. 按 image-studio 的文章逻辑图流程分析上面的文字，直接调用 Codex 内置 image_gen 生成一张 16:9 图片；检查构图和文字后，使用工具返回的保存路径或输出提示把接受结果复制到本地可写目录；图片无 Logo、无水印；',
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
