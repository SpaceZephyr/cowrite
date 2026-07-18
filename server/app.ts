import express, { type ErrorRequestHandler } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { assetsDir, buildCreateCommand, CowriteService } from './service.js'
import { JsonStore } from './store.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function createApp(service = new CowriteService(new JsonStore())) {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'cowrite' }))
  app.get('/api/pages', async (_request, response) => response.json(await service.listPages()))
  app.get('/api/pages/:id', async (request, response) => response.json(await service.getPage(request.params.id)))
  app.get('/api/pages/:id/command', async (request, response) => {
    const page = await service.getPage(request.params.id)
    response.type('text/plain').send(buildCreateCommand(page))
  })
  app.post('/api/pages', async (request, response) => {
    const input = z.object({
      title: z.string().max(300).optional(),
      prompt: z.string().max(5000).optional(),
      content: z.string().max(500_000).optional(),
    }).parse(request.body ?? {})
    response.status(201).json(await service.createPage(input))
  })
  app.patch('/api/pages/:id', async (request, response) => {
    const input = z.object({
      title: z.string().max(300).optional(),
      prompt: z.string().max(5000).optional(),
      content: z.string().max(500_000).optional(),
      expectedRevision: z.number().int().positive().optional(),
    }).parse(request.body)
    response.json(await service.updatePage(request.params.id, input))
  })
  app.delete('/api/pages/:id', async (request, response) => response.json(await service.deletePage(request.params.id)))
  app.post('/api/pages/:id/insert', async (request, response) => {
    const input = z.object({
      anchor: z.string().min(1).max(2000),
      markdown: z.string().min(1).max(100_000),
      expectedRevision: z.number().int().positive(),
    }).parse(request.body)
    response.json(await service.insertAfter(request.params.id, input.anchor, input.markdown, input.expectedRevision))
  })
  app.post('/api/assets', async (request, response) => {
    const input = z.object({ path: z.string().min(1).max(2000) }).parse(request.body)
    response.status(201).json(await service.uploadAsset(input.path))
  })
  app.post('/api/assets/upload', express.raw({
    type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    limit: '10mb',
  }), async (request, response) => {
    const mimeType = request.headers['content-type']?.split(';', 1)[0] ?? ''
    if (!(request.body instanceof Buffer)) throw new Error('Paste a PNG, JPEG, GIF, or WebP image.')
    response.status(201).json(await service.uploadImage(request.body, mimeType))
  })
  app.use('/assets', express.static(assetsDir))

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(projectRoot, 'dist')))
    app.get('/{*splat}', (_request, response) => response.sendFile(path.join(projectRoot, 'dist/index.html')))
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    response.status(message.includes('not found') ? 404 : message.includes('conflict') ? 409 : 400).json({ error: message })
  }
  app.use(errorHandler)
  return app
}
