export interface Page {
  id: string
  title: string
  prompt?: string
  content: string
  revision: number
  createdAt: string
  updatedAt: string
}

export interface CowriteData {
  pages: Page[]
}
