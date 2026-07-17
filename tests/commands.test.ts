import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { conversationCommand, explainerCommand, illustrateCommand, pageCreationCommand, polishCommand, slideHtmlCommand, slidePptxCommand, wechatLayoutCommand, xhsLayoutCommand } from '../src/agentCommands.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = { pageId: 'page_demo', selection: '这是一段需要处理的文字。' }

describe('agent command skill routing', () => {
  it('creates a requirement-driven task from the current page', () => {
    const command = pageCreationCommand({ pageId: 'page_demo', title: '原文章' }, '续写一个案例')
    expect(command).toContain('页面标题：原文章')
    expect(command).toContain('创作要求：续写一个案例')
    expect(command).toContain('cowrite_get_page')
    expect(command).toContain('cowrite_update_page')
    expect(command).toContain('不要无故删除原文')
  })

  it('routes illustration commands to bundled Image2 without silent fallback', () => {
    const command = illustrateCommand(input)
    expect(command).toContain('image-studio Skill')
    expect(command).toContain('GPT-Image-2 / LabNana')
    expect(command).toContain('不得静默替换为其他模型')
    expect(command).toContain('cowrite_upload_asset')
    expect(command).toContain('cowrite_insert_after')
  })

  it('routes HTML commands to the bundled HTML/PPT diagram skill', () => {
    const command = explainerCommand(input)
    expect(command).toContain('text-logic-diagram Skill')
    expect(command).toContain('HTML/PPT 风格')
    expect(command).toContain('自包含单文件 HTML')
    expect(command).toContain('aspect-ratio:16/9')
  })

  it('routes local editing to the writing optimization skill', () => {
    const command = polishCommand(input)
    expect(command).toContain('ai-writing-assistant Skill')
    expect(command).toContain('Method 5: Revision Optimization')
    expect(command).toContain('其余内容一字不动')
  })

  it('quotes selected text into an editable conversation draft', () => {
    const command = conversationCommand({ pageId: 'page_demo', selection: '第一行\n第二行' })
    expect(command).toContain('我想这样修改：')
    expect(command).toContain('【请在发送前把这里替换成你的修改要求】')
    expect(command).toContain('> 第一行\n> 第二行')
    expect(command).toContain('只替换这段引用原文')
  })

  it('routes full-page PPT output to the bundled editable PPTX workflow', () => {
    const command = slidePptxCommand({ pageId: 'page_demo', title: '演示文章' })
    expect(command).toContain('space-multi-design-ppt Skill')
    expect(command).toContain('PPTX（python-pptx 原生构建，可编辑）')
    expect(command).toContain('cowrite_upload_asset')
    expect(command).toContain('[下载 PPTX：演示文章](url)')
  })

  it('routes full-page HTML output to the bundled deck builder', () => {
    const command = slideHtmlCommand({ pageId: 'page_demo', title: '演示文章' })
    expect(command).toContain('space-multi-design-ppt Skill')
    expect(command).toContain('build_deck.py')
    expect(command).toContain('deck.html')
    expect(command).toContain('[打开 HTML 幻灯片：演示文章](url)')
  })

  it('routes full-page WeChat layout to the bundled copyable HTML workflow', () => {
    const command = wechatLayoutCommand({ pageId: 'page_demo', title: '公众号文章' })
    expect(command).toContain('space-wechat-layout Skill')
    expect(command).toContain('Claude、OpenAI 或 Google')
    expect(command).toContain('text/html 与 text/plain')
    expect(command).toContain('cowrite_upload_asset')
    expect(command).toContain('[公众号排版预览：公众号文章](url)')
  })

  it('routes full-page Xiaohongshu layout through Image2 with required confirmations', () => {
    const command = xhsLayoutCommand({ pageId: 'page_demo', title: '小红书文章' })
    expect(command).toContain('baoyu-xhs-images Skill')
    expect(command).toContain('GPT-Image-2 / LabNana')
    expect(command).toContain('确认 1')
    expect(command).toContain('确认 2')
    expect(command).toContain('aspect-ratio=3:4')
    expect(command).toContain('cowrite_upload_asset')
    expect(command).toContain('![小红书图片 01：小红书文章](url)')
  })

  it('packages every routed skill without packaging the local API key', () => {
    for (const skill of ['cowrite', 'image-studio', 'text-logic-diagram', 'ai-writing-assistant', 'space-multi-design-ppt', 'space-wechat-layout', 'baoyu-xhs-images']) {
      expect(existsSync(path.join(projectRoot, 'skills', skill, 'SKILL.md'))).toBe(true)
    }
    expect(existsSync(path.join(projectRoot, 'skills/image-studio/scripts/generate_image.py'))).toBe(true)
    expect(existsSync(path.join(projectRoot, 'skills/text-logic-diagram/assets/template.html'))).toBe(true)
    expect(existsSync(path.join(projectRoot, 'skills/space-multi-design-ppt/scripts/build_deck.py'))).toBe(true)
    expect(existsSync(path.join(projectRoot, 'skills/space-wechat-layout/assets/static-preview-template.html'))).toBe(true)
    expect(existsSync(path.join(projectRoot, 'skills/baoyu-xhs-images/references/elements/canvas.md'))).toBe(true)
    expect(existsSync(path.join(projectRoot, 'skills/image-studio/.labnana.env'))).toBe(false)
  })
})
