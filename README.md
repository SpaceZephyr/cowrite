<h1 align="center">Cowrite</h1>

<p align="center"><code>cowrite</code></p>

<p align="center"><i>「你在 Agent 里说，文章在浏览器里长出来。」</i></p>

<p align="center">
  <img alt="Protocol" src="https://img.shields.io/badge/protocol-MCP-6B7280">
  <img alt="Bundled skills" src="https://img.shields.io/badge/bundled_skills-6-2563EB">
  <img alt="Output" src="https://img.shields.io/badge/output-Markdown%20%7C%20PNG%20%7C%20PPTX%20%7C%20HTML-111827">
  <img alt="Runtime" src="https://img.shields.io/badge/runtime-local-16A34A">
</p>

<p align="center">MIT · Codex / Claude Code compatible · Contact: Space</p>

Cowrite 是一个本地运行的对话式写作画布。浏览器负责承载和编辑文章，Codex / Claude Code 通过 MCP 读写同一份数据；配图、HTML 解释图和文章优化由仓库内置 Skill 完成。它同时提供 Codex 与 Claude Code marketplace，安装后会自动准备依赖、构建前端并启动本地服务。

## 安装

要求：Node.js 20.19+（或 22.12+）、npm，以及已登录的 Codex CLI 或 Claude Code。

### 让 Codex 自动安装

把下面这段口令发给 Codex：

```text
请安装 Cowrite：https://github.com/SpaceZephyr/cowrite.git
请依次运行：
1. codex plugin marketplace add SpaceZephyr/cowrite --ref main
2. codex plugin add cowrite@cowrite
3. codex plugin list，确认 Cowrite、6 个 Skills 和 Cowrite MCP 已安装
安装完成后告诉我需要新建一个任务来加载插件；新任务中调用 cowrite_get_status，返回本地画布地址。
```

也可以直接在终端安装：

```bash
codex plugin marketplace add SpaceZephyr/cowrite --ref main
codex plugin add cowrite@cowrite
```

安装后新建一个 Codex 任务，然后说：

```text
启动 Cowrite，并告诉我本地画布地址。
```

### 让 Claude Code 自动安装

把下面这段口令发给 Claude Code：

```text
请安装 Cowrite：https://github.com/SpaceZephyr/cowrite.git
请依次运行：
1. claude plugin marketplace add SpaceZephyr/cowrite
2. claude plugin install cowrite@cowrite --scope user
3. claude plugin list，确认 Cowrite、6 个 Skills 和 Cowrite MCP 已安装
安装完成后提醒我运行 /reload-plugins 或新开一个 Claude Code 会话；加载后调用 cowrite_get_status，返回本地画布地址。
```

也可以在 Claude Code 中手动执行：

```text
/plugin marketplace add SpaceZephyr/cowrite
/plugin install cowrite@cowrite
/reload-plugins
```

或直接使用终端命令：

```bash
claude plugin marketplace add SpaceZephyr/cowrite
claude plugin install cowrite@cowrite --scope user
```

### 首次启动会发生什么

插件的 MCP 首次加载时会自动：

1. 检查并安装 npm 依赖；
2. 构建 Cowrite 浏览器前端；
3. 在 `http://127.0.0.1:4320` 启动生产服务；
4. 注册 Cowrite MCP 工具；
5. 将页面和资产持久化到 `~/.cowrite/`。

首次启动可能需要几十秒。服务仅监听本机，不会把文章上传到远端。插件会话结束时，由插件启动的服务也会停止；下一次加载会自动恢复。

## 从源码运行

```bash
git clone https://github.com/SpaceZephyr/cowrite.git
cd cowrite
npm install
npm run dev
```

开发模式默认打开 [http://127.0.0.1:4321](http://127.0.0.1:4321)，API 位于 `127.0.0.1:4320`，测试页面数据保存在 `data/cowrite.json`。若 `4321` 被占用，Vite 会在终端显示自动切换后的地址。

## 写作工作流

1. 新建页面，填写标题和创作要求；Cowrite 会复制创作口令，Agent 完成后写回页面。
2. 在编辑器中选中文字，使用浮动工具栏的「配图」「HTML」「优化」或「指令」。
3. 点击每个 Page 顶部的「Slide」，选择 PPT 或 HTML；Agent 使用整篇内容生成 Slides，并把交付链接插回文章顶部。
4. 点击「排版」；Agent 自动匹配 Claude、OpenAI 或 Google 风格，生成可复制富 HTML 的公众号预览页并回写地址。
5. Agent 读取页面最新 revision，调用指定 Skill 产出结果，再通过 MCP 精确写回。
6. 编辑器轮询更新，人和 Agent 可以继续编辑同一页面；revision 乐观锁会阻止相互覆盖。

## 内置 Skill 路由

| Cowrite 操作 | 仓库内 Skill | 固定产物与约束 |
|---|---|---|
| 配图 | `skills/image-studio` | GPT-Image-2 / LabNana、16:9 PNG、不得静默切换模型 |
| HTML | `skills/text-logic-diagram` | 16:9 HTML/PPT 风格单页、内联 CSS + SVG、适合 iframe |
| 优化 | `skills/ai-writing-assistant` | Method 5 局部改写，只替换选中文字 |
| Slide | `skills/space-multi-design-ppt` | 智能品牌匹配；原生可编辑 PPTX 或 16:9 HTML deck |
| 排版 | `skills/space-wechat-layout` | 自动匹配 Claude / OpenAI / Google；微信公众号可复制富 HTML 预览页 |
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

`.labnana.env` 已加入 `.gitignore`。通过 marketplace 安装时，推荐在启动 Codex / Claude Code 前设置环境变量；从源码运行时也可以使用本地 `.labnana.env`。Image2 的中间产物不会进入 Git。

## Agent 接入

```text
.codex-plugin/plugin.json                 Codex 插件描述与 Skill 入口
.agents/plugins/marketplace.json          Codex marketplace
.claude-plugin/plugin.json                Claude Code 插件描述
.claude-plugin/marketplace.json           Claude Code marketplace
.mcp.json                                 Codex / Claude Code 双端 MCP 启动配置
scripts/start-plugin.mjs                  自动安装、构建、启动与持久化
skills/cowrite/SKILL.md                   页面读写与并发规则
skills/image-studio/                      Image2 生图脚本、风格和提示词模板
skills/text-logic-diagram/                HTML/PPT 逻辑图规范与模板
skills/ai-writing-assistant/              文章创作与局部优化方法
skills/space-multi-design-ppt/             文章转 PPTX / HTML Slides 工作流
skills/space-wechat-layout/                 微信公众号排版与可复制 HTML 预览模板
```

MCP 提供七个工具：`cowrite_get_status`、`cowrite_list_pages`、`cowrite_get_page`、`cowrite_create_page`、`cowrite_update_page`、`cowrite_upload_asset` 和 `cowrite_insert_after`。

如果只想临时加载本地源码而不安装 marketplace，也可以使用 Claude Code 的开发参数：

```bash
claude --plugin-dir /absolute/path/to/cowrite
```

插件模式不需要手动保持 `npm run dev`；自启动运行器会管理生产服务。源码开发时仍使用 `npm run dev`。

## 架构

```text
浏览器 Vditor ───────────────┐
                             ├─> Express API ─> ~/.cowrite/cowrite.json
Codex / Claude + Skills ─MCP─┘                  └─> ~/.cowrite/assets/
```

- 服务只监听 `127.0.0.1`，网页本身不执行 Agent 或 Skill。
- marketplace 安装模式使用 `~/.cowrite/` 持久化；源码开发模式使用仓库内 `data/`。
- 列表接口不返回正文，Agent 只在需要时读取完整页面，减少上下文消耗。
- 带 `prompt` 且 `revision = 1` 的页面会显示为“等待 Agent 创作”。
- 图片和 HTML 先进入 Cowrite 资产库，再以 Markdown 图片或 iframe 插入锚点段落后。

## 验证

```bash
npm test
npm run build
npm run probe:plugin
```
