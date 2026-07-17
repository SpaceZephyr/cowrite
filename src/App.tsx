import { useCallback, useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import type { Page } from '../shared/types'
import { customCommand, explainerCommand, illustrateCommand, polishCommand, slideHtmlCommand, slidePptxCommand } from './agentCommands'
import './App.css'

type PageMeta = Omit<Page, 'content'>

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

function NewPageModal({ onClose, onCreated, notify }: {
  onClose: () => void
  onCreated: (page: Page) => void
  notify: (text: string) => void
}) {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)

  const create = async () => {
    setCreating(true)
    try {
      const page = await api<Page>('/api/pages', { method: 'POST', body: JSON.stringify({ title, prompt }) })
      if (prompt.trim()) {
        const command = await (await fetch(`/api/pages/${page.id}/command`)).text()
        await navigator.clipboard.writeText(command)
        notify('页面已创建，口令已复制。粘贴给 Codex，内容会写进这个页面')
      }
      onCreated(page)
    } finally {
      setCreating(false)
    }
  }

  return <div className="modal-mask" onClick={onClose}>
    <div className="modal" onClick={(event) => event.stopPropagation()}>
      <h2>新建页面</h2>
      <input autoFocus value={title} placeholder="页面标题" onChange={(event) => setTitle(event.target.value)} />
      <textarea value={prompt} placeholder="想让 Agent 创作什么？（可选）&#10;例如：写一篇 1500 字的文章，讲清楚 Skill 生态的三个层次……&#10;&#10;留空则创建空白页面，自己动手写。" onChange={(event) => setPrompt(event.target.value)} />
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary" disabled={creating || !title.trim()} onClick={create}>
          {prompt.trim() ? '创建并复制口令' : '创建空白页'}
        </button>
      </div>
    </div>
  </div>
}

function SlideModal({ page, onClose, onChoose }: {
  page: Page
  onClose: () => void
  onChoose: (format: 'pptx' | 'html') => void
}) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal slide-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <div><h2>把当前 Page 变成 Slides</h2><p>{page.title}</p></div>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      <p className="slide-hint">选择输出格式。品牌风格会由 space-multi-design-ppt 根据全文智能匹配。</p>
      <div className="slide-options">
        <button className="slide-option" onClick={() => onChoose('pptx')}>
          <span className="slide-format pptx">P</span>
          <span><b>PPT</b><small>生成原生可编辑的 .pptx 文件</small></span>
          <i>→</i>
        </button>
        <button className="slide-option" onClick={() => onChoose('html')}>
          <span className="slide-format html">H</span>
          <span><b>HTML</b><small>生成 16:9 多页网页幻灯片</small></span>
          <i>→</i>
        </button>
      </div>
      <p className="slide-footnote">选择后会复制任务口令。粘贴给 Codex / Claude Code，Agent 将读取当前页面、生成 Slides，并把交付地址插回文章顶部。</p>
    </div>
  </div>
}

function Editor({ page, onDirty, onSaved, notify }: {
  page: Page
  onDirty: () => void
  onSaved: (page: Page) => void
  notify: (text: string) => void
}) {
  const holderRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<Vditor | null>(null)
  const revisionRef = useRef(page.revision)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; text: string; custom: boolean } | null>(null)
  const [instruction, setInstruction] = useState('')
  const pageId = page.id

  const save = useCallback(async () => {
    const editor = vditorRef.current
    if (!editor || !dirtyRef.current) return
    const content = editor.getValue()
    try {
      const updated = await api<Page>(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, expectedRevision: revisionRef.current }),
      })
      revisionRef.current = updated.revision
      dirtyRef.current = false
      onSaved(updated)
    } catch (reason) {
      notify(String(reason instanceof Error ? reason.message : reason))
    }
  }, [pageId, onSaved, notify])

  useEffect(() => {
    if (!holderRef.current) return
    let disposed = false
    const editor = new Vditor(holderRef.current, {
      mode: 'ir',
      value: page.content,
      placeholder: '开始写作，或把口令粘贴给 Codex 让它来写……',
      cache: { enable: false },
      toolbar: [],
      counter: { enable: false },
      after: () => { if (disposed) editor.destroy() },
      input: () => {
        dirtyRef.current = true
        onDirty()
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(save, 800)
      },
    })
    vditorRef.current = editor
    return () => {
      disposed = true
      clearTimeout(timerRef.current)
      try { editor.destroy() } catch { /* 未完成初始化时忽略 */ }
      vditorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  // Agent 在后台写回时（revision 变化且本地无未保存修改），刷新编辑器
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const latest = await api<Page>(`/api/pages/${pageId}`)
        if (latest.revision !== revisionRef.current && !dirtyRef.current) {
          revisionRef.current = latest.revision
          vditorRef.current?.setValue(latest.content)
          onSaved(latest)
          notify('Agent 已更新这个页面')
        }
      } catch { /* 服务重启间隙忽略 */ }
    }, 4000)
    return () => clearInterval(poll)
  }, [pageId, onSaved, notify])

  // 选中文字时显示浮动工具栏
  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const update = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) { setSelectionBar(null); return }
      const text = selection.toString().trim()
      if (!text || !holder.contains(selection.anchorNode)) { setSelectionBar(null); return }
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      setSelectionBar((current) => current?.custom ? current : { x: rect.left + rect.width / 2, y: rect.top, text, custom: false })
    }
    const onMouseUp = () => setTimeout(update, 0)
    const onKeyUp = (event: KeyboardEvent) => { if (event.key.startsWith('Arrow') || event.shiftKey) setTimeout(update, 0) }
    const onDown = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.selection-bar')) setSelectionBar(null) }
    holder.addEventListener('mouseup', onMouseUp)
    holder.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onDown)
    return () => {
      holder.removeEventListener('mouseup', onMouseUp)
      holder.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onDown)
    }
  }, [pageId])

  // 在 Markdown 原文中定位选中文字并包裹格式（避免操作 DOM 选区带来的段落错位）
  const wrapSelection = (before: string, after: string) => {
    const editor = vditorRef.current
    if (!editor || !selectionBar) return
    const markdown = editor.getValue()
    const text = selectionBar.text
    const index = markdown.indexOf(text)
    setSelectionBar(null)
    if (index === -1) { notify('没有在正文中找到选中文字，请重新选择'); return }
    const wrapped = markdown.slice(0, index) + before + text + after + markdown.slice(index + text.length)
    editor.setValue(wrapped)
    dirtyRef.current = true
    onDirty()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, 400)
  }

  const copyAi = async (command: string, hint: string) => {
    await navigator.clipboard.writeText(command)
    setSelectionBar(null)
    setInstruction('')
    notify(hint)
  }

  return <>
    <div className="editor-holder" ref={holderRef} />
    {selectionBar && <div className="selection-bar" style={{ left: selectionBar.x, top: selectionBar.y }}>
      {selectionBar.custom
        ? <div className="custom-input">
            <input
              autoFocus
              value={instruction}
              placeholder="对选中文字做什么？回车复制口令"
              onChange={(event) => setInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && instruction.trim()) copyAi(customCommand({ pageId, selection: selectionBar.text }, instruction.trim()), '指令口令已复制，粘贴给 Codex')
                if (event.key === 'Escape') { setSelectionBar(null); setInstruction('') }
              }}
            />
          </div>
        : <>
            <button title="加粗" onMouseDown={(event) => { event.preventDefault(); wrapSelection('**', '**') }}><b>B</b></button>
            <button title="斜体" onMouseDown={(event) => { event.preventDefault(); wrapSelection('*', '*') }}><i>I</i></button>
            <button title="删除线" onMouseDown={(event) => { event.preventDefault(); wrapSelection('~~', '~~') }}><s>S</s></button>
            <button title="行内代码" onMouseDown={(event) => { event.preventDefault(); wrapSelection('`', '`') }}>{'<>'}</button>
            <button title="引用" onMouseDown={(event) => { event.preventDefault(); wrapSelection('\n> ', '\n') }}>&gt;</button>
            <span className="bar-divider" />
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(illustrateCommand({ pageId, selection: selectionBar.text }), 'Image2 配图口令已复制，结果会插入选中段落下方') }}>配图</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(explainerCommand({ pageId, selection: selectionBar.text }), 'HTML/PPT 解释图口令已复制，结果会插入选中段落下方') }}>HTML</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(polishCommand({ pageId, selection: selectionBar.text }), 'Skill 优化口令已复制，Agent 只会改写这段文字') }}>优化</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); setSelectionBar((current) => current ? { ...current, custom: true } : null) }}>指令</button>
          </>}
    </div>}
  </>
}

function App() {
  const [pages, setPages] = useState<PageMeta[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'dirty'>('saved')
  const [toast, setToast] = useState('')

  const refreshList = useCallback(async () => {
    const list = await api<PageMeta[]>('/api/pages')
    setPages(list)
    return list
  }, [])

  useEffect(() => {
    refreshList().then((list) => {
      if (list.length > 0) setActiveId((current) => current ?? list[0].id)
    }).catch(() => setToast('无法连接本地服务，请先运行 npm run dev'))
  }, [refreshList])

  useEffect(() => {
    const timer = setInterval(() => { refreshList().catch(() => {}) }, 5000)
    return () => clearInterval(timer)
  }, [refreshList])

  useEffect(() => {
    if (!activeId) { setActivePage(null); return }
    api<Page>(`/api/pages/${activeId}`).then(setActivePage).catch(() => setActivePage(null))
  }, [activeId])

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer) }, [toast])

  const notify = useCallback((text: string) => setToast(text), [])
  const onSaved = useCallback((updated: Page) => {
    setSaveState('saved')
    setActivePage((current) => current?.id === updated.id ? { ...current, ...updated } : current)
    setPages((current) => current?.map((item) => item.id === updated.id ? { ...item, title: updated.title, revision: updated.revision, updatedAt: updated.updatedAt } : item) ?? null)
  }, [])
  const onDirty = useCallback(() => setSaveState('dirty'), [])

  const renameTitle = async (title: string) => {
    if (!activePage || title === activePage.title) return
    const updated = await api<Page>(`/api/pages/${activePage.id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    onSaved(updated)
    await refreshList()
  }

  const removePage = async () => {
    if (!activePage) return
    await api(`/api/pages/${activePage.id}`, { method: 'DELETE' })
    const list = await refreshList()
    setActiveId(list[0]?.id ?? null)
    notify('页面已删除')
  }

  const copyCommand = async () => {
    if (!activePage) return
    const command = await (await fetch(`/api/pages/${activePage.id}/command`)).text()
    await navigator.clipboard.writeText(command)
    notify('口令已复制，粘贴给 Codex / Claude Code')
  }

  const copySlideCommand = async (format: 'pptx' | 'html') => {
    if (!activePage) return
    const input = { pageId: activePage.id, title: activePage.title }
    const command = format === 'pptx' ? slidePptxCommand(input) : slideHtmlCommand(input)
    await navigator.clipboard.writeText(command)
    setSlideOpen(false)
    notify(`${format === 'pptx' ? 'PPT' : 'HTML'} Slide 口令已复制，粘贴给 Agent 后会把结果地址插回当前页面`)
  }

  if (!pages) return <div className="loading"><span>C</span><p>正在打开 Cowrite…</p></div>

  return <div className={`shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="logo">C</span><b>Cowrite</b>
        <button title="收起目录" onClick={() => setSidebarOpen(false)}>«</button>
      </div>
      <button className="new-page" onClick={() => setModalOpen(true)}>＋ 新建页面</button>
      <nav>
        {pages.map((page) => <button
          key={page.id}
          className={page.id === activeId ? 'active' : ''}
          onClick={() => setActiveId(page.id)}
        >
          <span className="doc-icon">▤</span>
          <span className="doc-title">{page.title}</span>
          {page.prompt && page.revision === 1 && <span className="pending-dot" title="等待 Agent 创作" />}
        </button>)}
      </nav>
      <footer><span className="mcp-dot" />Cowrite MCP · 本地</footer>
    </aside>

    <main className="workspace">
      <div className="topbar">
        {!sidebarOpen && <button className="icon-button" title="展开目录" onClick={() => setSidebarOpen(true)}>☰</button>}
        {activePage && <>
          <input
            className="title-input"
            key={activePage.id}
            defaultValue={activePage.title}
            placeholder="未命名页面"
            onBlur={(event) => { if (event.target.value.trim()) renameTitle(event.target.value.trim()) }}
          />
          <div className="topbar-right">
            <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '已保存' : '保存中…'}</span>
            <button className="slide-trigger" onClick={() => setSlideOpen(true)} title="把当前 Page 转换为 PPT 或 HTML">▰ Slide</button>
            <button onClick={copyCommand} title="复制创作口令给 Agent">⌘ 口令</button>
            <button className="danger" onClick={removePage}>删除</button>
          </div>
        </>}
      </div>
      {activePage?.prompt && activePage.revision === 1 && <div className="prompt-banner">
        <div><b>等待 Agent 创作</b><p>{activePage.prompt}</p></div>
        <button onClick={copyCommand}>复制口令</button>
      </div>}
      {activePage
        ? <Editor key={activePage.id} page={activePage} onDirty={onDirty} onSaved={onSaved} notify={notify} />
        : <div className="empty-state"><p>没有页面。</p><button className="primary" onClick={() => setModalOpen(true)}>＋ 新建页面</button></div>}
    </main>

    {modalOpen && <NewPageModal
      onClose={() => setModalOpen(false)}
      onCreated={async (page) => { setModalOpen(false); await refreshList(); setActiveId(page.id) }}
      notify={notify}
    />}
    {slideOpen && activePage && <SlideModal
      page={activePage}
      onClose={() => setSlideOpen(false)}
      onChoose={copySlideCommand}
    />}
    {toast && <div className="toast">✓ {toast}</div>}
  </div>
}

export default App
