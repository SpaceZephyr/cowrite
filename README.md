<h1 align="center">Cowrite</h1>

<p align="center"><code>cowrite</code></p>

<p align="center"><i>「你在 Agent 里说，文章在浏览器里长出来。」</i></p>

<p align="center">
  <img alt="Protocol" src="https://img.shields.io/badge/protocol-MCP-6B7280">
  <img alt="Bundled skills" src="https://img.shields.io/badge/bundled_skills-4-2563EB">
  <img alt="Output" src="https://img.shields.io/badge/output-Markdown%20%7C%20PNG%20%7C%20HTML-111827">
  <img alt="Runtime" src="https://img.shields.io/badge/runtime-local-16A34A">
</p>

<p align="center">MIT · Codex / Claude Code compatible · Contact: Space</p>

Cowrite 是一个本地运行的对话式写作画布。浏览器负责承载和编辑文章，Codex / Claude Code 通过 MCP 读写同一份数据；配图、HTML 解释图和文章优化由仓库内置 Skill 完成，不再依赖临时拼装的通用提示词。

## 快速启动

```bash
npm install
npm run dev
```

默认打开 [http://127.0.0.1:4321](http://127.0.0.1:4321)，API 位于 `127.0.0.1:4320`，页面数据保存在 `data/cowrite.json`。若 `4321` 被占用，Vite 会在终端显示自动切换后的地址。

## 写作工作流

1. 新建页面，填写标题和创作要求；Cowrite 会复制创作口令，Agent 完成后写回页面。
2. 在编辑器中选中文字，使用浮动工具栏的「配图」「HTML」「优化」或「指令」。
3. Agent 读取页面最新 revision，调用指定 Skill 产出结果，再通过 MCP 精确写回。
4. 编辑器轮询更新，人和 Agent 可以继续编辑同一页面；revision 乐观锁会阻止相互覆盖。

## 内置 Skill 路由

| Cowrite 操作 | 仓库内 Skill | 固定产物与约束 |
|---|---|---|
| 配图 | `skills/image-studio` | GPT-Image-2 / LabNana、16:9 PNG、不得静默切换模型 |
| HTML | `skills/text-logic-diagram` | 16:9 HTML/PPT 风格单页、内联 CSS + SVG、适合 iframe |
| 优化 | `skills/ai-writing-assistant` | Method 5 局部改写，只替换选中文字 |
| 页面读写 | `skills/cowrite` | MCP 操作、revision 合并、防覆盖规则 |

按钮复制的口令会显式声明 Skill 名称和已确认参数。配图链路若缺少凭据、余额或本地服务，会直接返回失败，不会改用其他模型并插入来源不明的图片。

## 配置 Image2

真实密钥不随仓库分发。可使用环境变量：

```bash
export LABNANA_API_KEY="your-key"
```

也可以复制本地配置示例：

```bash
cp skills/image-studio/.labnana.env.example skills/image-studio/.labnana.env
```

`.labnana.env` 已加入 `.gitignore`。Image2 的中间产物保存在 `data/generated/image-studio/`，上传后的 Cowrite 资产保存在 `data/assets/`。

## Agent 接入

```text
.codex-plugin/plugin.json                 Codex 插件描述与 Skill 入口
.mcp.json                                 stdio MCP 配置
skills/cowrite/SKILL.md                   页面读写与并发规则
skills/image-studio/                      Image2 生图脚本、风格和提示词模板
skills/text-logic-diagram/                HTML/PPT 逻辑图规范与模板
skills/ai-writing-assistant/              文章创作与局部优化方法
```

MCP 提供六个工具：`cowrite_list_pages`、`cowrite_get_page`、`cowrite_create_page`、`cowrite_update_page`、`cowrite_upload_asset` 和 `cowrite_insert_after`。

Codex 可将本目录作为 personal marketplace 插件安装。Claude Code 在本目录启动时会读取 `.mcp.json`；也可以手动注册：

```bash
claude mcp add cowrite -- npx -y tsx /absolute/path/to/cowrite/mcp/index.ts
```

使用 Agent 前需保持 `npm run dev` 运行。

## 架构

```text
浏览器 Vditor ───────────────┐
                             ├─> Express API ─> data/cowrite.json
Agent + bundled Skills ─MCP──┘                  └─> data/assets/
```

- 服务只监听 `127.0.0.1`，网页本身不执行 Agent 或 Skill。
- 列表接口不返回正文，Agent 只在需要时读取完整页面，减少上下文消耗。
- 带 `prompt` 且 `revision = 1` 的页面会显示为“等待 Agent 创作”。
- 图片和 HTML 先进入 Cowrite 资产库，再以 Markdown 图片或 iframe 插入锚点段落后。

## 验证

```bash
npm test
npm run build
```
