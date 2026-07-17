import { copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nanoid } from 'nanoid'
import type { CowriteData, Page } from '../shared/types.js'
import { JsonStore } from './store.js'

const isoNow = () => new Date().toISOString()

const here = path.dirname(fileURLToPath(import.meta.url))
export const assetsDir = process.env.COWRITE_ASSETS || path.resolve(here, '../data/assets')

export interface PagePatch {
  title?: string
  prompt?: string
  content?: string
  expectedRevision?: number
}

export function buildCreateCommand(page: Page): string {
  return [
    '请完成 Cowrite 页面的创作任务。',
    '',
    `页面 ID：${page.id}`,
    `标题：${page.title}`,
    ...(page.prompt ? ['', '创作要求：', page.prompt] : []),
    '',
    '步骤：',
    `1. 调用 cowrite_get_page 读取页面 ${page.id}，拿到最新 revision；`,
    '2. 按创作要求撰写 Markdown 正文（如页面已有内容，在其基础上完善，不要丢弃人工修改）；',
    '3. 调用 cowrite_update_page 写回，带上 expected_revision；',
    '4. revision 冲突时重新读取合并后再写。',
  ].join('\n')
}

export class CowriteService {
  constructor(private readonly store: JsonStore) {}

  async getState(): Promise<CowriteData> {
    return this.store.read()
  }

  async listPages(): Promise<Omit<Page, 'content'>[]> {
    const data = await this.store.read()
    return data.pages.map(({ content: _content, ...rest }) => rest)
  }

  async getPage(id: string): Promise<Page> {
    const page = (await this.store.read()).pages.find((item) => item.id === id)
    if (!page) throw new Error(`Page '${id}' was not found. List pages to obtain a valid ID.`)
    return page
  }

  async createPage(input: { title?: string; prompt?: string; content?: string }): Promise<Page> {
    return this.store.update((data) => {
      const now = isoNow()
      const page: Page = {
        id: `page_${nanoid(8)}`,
        title: input.title?.trim() || '未命名页面',
        ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
        content: input.content ?? '',
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }
      data.pages.unshift(page)
      return structuredClone(page)
    })
  }

  async updatePage(id: string, patch: PagePatch): Promise<Page> {
    return this.store.update((data) => {
      const page = data.pages.find((item) => item.id === id)
      if (!page) throw new Error(`Page '${id}' was not found.`)
      if (patch.expectedRevision !== undefined && page.revision !== patch.expectedRevision) {
        throw new Error(`Revision conflict: page is at revision ${page.revision}, not ${patch.expectedRevision}. Read the page again before updating.`)
      }
      if (patch.content !== undefined && patch.expectedRevision === undefined) {
        throw new Error('Updating content requires expectedRevision to avoid overwriting concurrent edits.')
      }
      if (patch.title !== undefined) page.title = patch.title
      if (patch.prompt !== undefined) {
        if (patch.prompt.trim()) page.prompt = patch.prompt.trim()
        else delete page.prompt
      }
      if (patch.content !== undefined) {
        page.content = patch.content
        page.revision += 1
      }
      page.updatedAt = isoNow()
      return structuredClone(page)
    })
  }

  async insertAfter(id: string, anchor: string, markdown: string, expectedRevision: number): Promise<Page> {
    return this.store.update((data) => {
      const page = data.pages.find((item) => item.id === id)
      if (!page) throw new Error(`Page '${id}' was not found.`)
      if (page.revision !== expectedRevision) {
        throw new Error(`Revision conflict: page is at revision ${page.revision}, not ${expectedRevision}. Read the page again before inserting.`)
      }
      const anchorIndex = page.content.indexOf(anchor)
      if (anchorIndex === -1) {
        throw new Error('Anchor text was not found in the page content. Read the page and pass an exact substring of the current content as anchor.')
      }
      const paragraphEnd = page.content.indexOf('\n\n', anchorIndex + anchor.length)
      const insertAt = paragraphEnd === -1 ? page.content.length : paragraphEnd
      const block = `\n\n${markdown.trim()}`
      page.content = page.content.slice(0, insertAt) + block + page.content.slice(insertAt)
      page.revision += 1
      page.updatedAt = isoNow()
      return structuredClone(page)
    })
  }

  async uploadAsset(sourcePath: string): Promise<{ url: string; fileName: string }> {
    const resolved = path.resolve(sourcePath)
    const info = await stat(resolved).catch(() => null)
    if (!info?.isFile()) throw new Error(`Asset file was not found at '${sourcePath}'. Pass an absolute path to an existing local file.`)
    if (info.size > 20 * 1024 * 1024) throw new Error('Asset file exceeds the 20 MB limit.')
    const extension = path.extname(resolved).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.html'].includes(extension)) {
      throw new Error(`Unsupported asset type '${extension}'. Allowed: png, jpg, jpeg, gif, webp, svg, html.`)
    }
    const fileName = `${nanoid(10)}${extension}`
    await mkdir(assetsDir, { recursive: true })
    await copyFile(resolved, path.join(assetsDir, fileName))
    return { url: `/assets/${fileName}`, fileName }
  }

  async deletePage(id: string): Promise<{ deleted: true }> {
    return this.store.update((data) => {
      const index = data.pages.findIndex((item) => item.id === id)
      if (index === -1) throw new Error(`Page '${id}' was not found.`)
      data.pages.splice(index, 1)
      return { deleted: true as const }
    })
  }
}
