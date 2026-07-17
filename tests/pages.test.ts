import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { CowriteService } from '../server/service.js'
import { JsonStore } from '../server/store.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function testApp() {
  const store = new JsonStore(path.join(directory, 'cowrite.json'))
  return createApp(new CowriteService(store))
}

describe('cowrite pages', () => {
  it('creates a page with a prompt and builds a command', async () => {
    const app = testApp()
    const page = await request(app).post('/api/pages').send({ title: 'Skill 生态', prompt: '写一篇 1500 字文章' }).expect(201)
    expect(page.body.revision).toBe(1)
    const command = await request(app).get(`/api/pages/${page.body.id}/command`).expect(200)
    expect(command.text).toContain(page.body.id)
    expect(command.text).toContain('写一篇 1500 字文章')
  })

  it('omits content in the list but returns it on get', async () => {
    const app = testApp()
    const list = await request(app).get('/api/pages').expect(200)
    expect(list.body[0].content).toBeUndefined()
    const page = await request(app).get('/api/pages/page_welcome').expect(200)
    expect(page.body.content).toContain('Cowrite')
  })

  it('protects content edits with revision checks', async () => {
    const app = testApp()
    const page = await request(app).get('/api/pages/page_welcome').expect(200)
    const updated = await request(app).patch('/api/pages/page_welcome').send({ content: '# 新内容', expectedRevision: page.body.revision }).expect(200)
    expect(updated.body.revision).toBe(page.body.revision + 1)
    await request(app).patch('/api/pages/page_welcome').send({ content: '# 覆盖', expectedRevision: page.body.revision }).expect(409)
    await request(app).patch('/api/pages/page_welcome').send({ content: '# 无保护' }).expect(400)
  })

  it('inserts a block after the anchor paragraph', async () => {
    const app = testApp()
    const page = await request(app).get('/api/pages/page_welcome').expect(200)
    const inserted = await request(app).post('/api/pages/page_welcome/insert').send({
      anchor: '三种用法',
      markdown: '![插图](/assets/demo.png)',
      expectedRevision: page.body.revision,
    }).expect(200)
    expect(inserted.body.content).toContain('## 三种用法\n\n![插图](/assets/demo.png)')
    await request(app).post('/api/pages/page_welcome/insert').send({
      anchor: '不存在的锚点文字',
      markdown: 'x',
      expectedRevision: inserted.body.revision,
    }).expect(404)
  })

  it('renames without a revision bump and deletes', async () => {
    const app = testApp()
    const page = await request(app).get('/api/pages/page_welcome').expect(200)
    const renamed = await request(app).patch('/api/pages/page_welcome').send({ title: '新标题' }).expect(200)
    expect(renamed.body.revision).toBe(page.body.revision)
    await request(app).delete('/api/pages/page_welcome').expect(200)
    await request(app).get('/api/pages/page_welcome').expect(404)
  })
})
