import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CowriteData } from '../shared/types.js'
import { seedData } from './seed.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultDataFile = path.resolve(here, '../data/cowrite.json')

export class JsonStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_DATA || defaultDataFile) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await readFile(this.filePath, 'utf8')
    } catch {
      await this.write(structuredClone(seedData))
    }
  }

  async read(): Promise<CowriteData> {
    await this.init()
    return JSON.parse(await readFile(this.filePath, 'utf8')) as CowriteData
  }

  async write(data: CowriteData): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      const tempPath = `${this.filePath}.tmp`
      await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
      await rename(tempPath, this.filePath)
    })
    await this.writeChain
  }

  async update<T>(mutator: (data: CowriteData) => T | Promise<T>): Promise<T> {
    const data = await this.read()
    const result = await mutator(data)
    await this.write(data)
    return result
  }
}
