import type { CowriteData } from '../shared/types.js'

const now = '2026-07-17T12:00:00.000Z'

export const seedData: CowriteData = {
  pages: [
    {
      id: 'page_welcome',
      title: '欢迎使用 Cowrite',
      content: [
        '# 欢迎使用 Cowrite',
        '',
        'Cowrite 是一个本地运行的对话式写作画布：**你在 Codex / Claude Code 里说，文章在这里长出来。**',
        '',
        '## 三种用法',
        '',
        '1. **新建页面时交给 Agent**：左上角「＋ 新建页面」，写下你想创作什么，复制口令粘贴给 Agent，内容会写进页面。',
        '2. **直接在 Agent 对话里说**：「在 cowrite 里创建一篇关于 X 的文章」或「把 cowrite 里那篇 X 的第二段改得更口语化」。',
        '3. **随时手动编辑**：这个编辑器支持 Markdown 即时渲染，所有修改自动保存，Agent 不会覆盖你的改动。',
        '',
        '> 左侧目录默认收起，点左上角 ☰ 展开。',
      ].join('\n'),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
  ],
}
