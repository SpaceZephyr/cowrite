import { useCallback, useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import type { Page } from '../shared/types'
import { conversationCommand, explainerCommand, illustrateCommand, larkSendCommand, pageCreationCommand, polishCommand, slideHtmlCommand, slidePptxCommand, wechatLayoutCommand, xhsLayoutCommand } from './agentCommands'
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
  const [mode, setMode] = useState<'write' | 'import'>('write')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [importedContent, setImportedContent] = useState('')
  const [importedFileName, setImportedFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chooseImport = () => {
    setMode('import')
    fileInputRef.current?.click()
  }

  const loadMarkdown = async (file?: File) => {
    if (!file) return
    if (!/\.(md|markdown)$/i.test(file.name)) {
      notify('请选择 .md 或 .markdown 文件')
      return
    }
    const content = await file.text()
    if (!content.trim()) {
      notify('这个 Markdown 文件是空的')
      return
    }
    if (content.length > 500_000) {
      notify('Markdown 内容超过 500,000 个字符，暂时无法导入')
      return
    }
    const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
    setImportedContent(content)
    setImportedFileName(file.name)
    setTitle(heading || file.name.replace(/\.(md|markdown)$/i, ''))
  }

  const create = async () => {
    setCreating(true)
    try {
      const input = mode === 'import' ? { title, content: importedContent } : { title, prompt }
      const page = await api<Page>('/api/pages', { method: 'POST', body: JSON.stringify(input) })
      if (mode === 'write' && prompt.trim()) {
        const command = await (await fetch(`/api/pages/${page.id}/command`)).text()
        await navigator.clipboard.writeText(command)
        notify('页面已创建，口令已复制。粘贴给 Codex，内容会写进这个页面')
      } else if (mode === 'import') {
        notify(`已导入 ${importedFileName}`)
      }
      onCreated(page)
    } catch (error) {
      notify(error instanceof Error ? error.message : '创建页面失败')
    } finally {
      setCreating(false)
    }
  }

  return <div className="modal-mask" onClick={onClose}>
    <div className="modal new-page-modal" onClick={(event) => event.stopPropagation()}>
      <h2>新建页面</h2>
      <div className="new-page-modes" role="tablist" aria-label="新建页面方式">
        <button className={mode === 'write' ? 'active' : ''} role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')}>输入内容</button>
        <button className={mode === 'import' ? 'active' : ''} role="tab" aria-selected={mode === 'import'} onClick={chooseImport}>导入 Markdown</button>
      </div>
      <input ref={fileInputRef} className="markdown-file-input" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={(event) => loadMarkdown(event.target.files?.[0])} />
      {mode === 'write' ? <>
        <input autoFocus value={title} placeholder="页面标题" onChange={(event) => setTitle(event.target.value)} />
        <textarea value={prompt} placeholder="想让 Agent 创作什么？（可选）&#10;例如：写一篇 1500 字的文章，讲清楚 Skill 生态的三个层次……&#10;&#10;留空则创建空白页面，自己动手写。" onChange={(event) => setPrompt(event.target.value)} />
      </> : <>
        <button className={`markdown-picker ${importedFileName ? 'selected' : ''}`} onClick={() => fileInputRef.current?.click()}>
          <b>{importedFileName || '选择 Markdown 文件'}</b>
          <small>{importedFileName ? '点击可重新选择' : '支持 .md 和 .markdown'}</small>
        </button>
        <input value={title} placeholder="导入后的页面标题" onChange={(event) => setTitle(event.target.value)} />
      </>}
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary" disabled={creating || !title.trim() || (mode === 'import' && !importedContent)} onClick={create}>
          {mode === 'import' ? '导入页面' : prompt.trim() ? '创建并复制口令' : '创建空白页'}
        </button>
      </div>
    </div>
  </div>
}

function LayoutModal({ onClose, onChoose }: {
  onClose: () => void
  onChoose: (format: 'wechat' | 'xhs') => void
}) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal slide-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>选择排版</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      <div className="slide-options">
        <button className="slide-option" onClick={() => onChoose('wechat')}>
          <b>公众号排版</b><small>可复制富 HTML</small>
        </button>
        <button className="slide-option" onClick={() => onChoose('xhs')}>
          <b>小红书排版</b><small>Image2 图片组</small>
        </button>
      </div>
      <p className="slide-footnote">选择后复制任务，粘贴给 Agent 执行。</p>
    </div>
  </div>
}

function CowriteModal({ page, onClose, onUsePage, onSubmit }: {
  page: Page
  onClose: () => void
  onUsePage: () => void
  onSubmit: (requirement: string) => void
}) {
  const [mode, setMode] = useState<'choose' | 'page'>('choose')
  const [requirement, setRequirement] = useState('')
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal cowrite-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>Cowrite</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      {mode === 'choose' ? <>
        <div className="cowrite-options">
          <button className="cowrite-mode" onClick={onUsePage}>
            <b>按页面内容为要求创作</b>
            <small>直接复制当前页面全文</small>
          </button>
          <button className="cowrite-mode" onClick={() => setMode('page')}>
            <b>输入自定义创作要求</b>
            <small>填写你的具体创作任务</small>
          </button>
        </div>
        <p className="slide-footnote">二选一，任务会复制到 Codex / Claude Code 对话框。</p>
      </> : <>
        <div className="cowrite-current-page">
          <span>当前页面</span>
          <b>{page.title}</b>
        </div>
        <textarea autoFocus value={requirement} placeholder="请输入创作要求" onChange={(event) => setRequirement(event.target.value)} />
        <div className="modal-actions cowrite-actions">
          <button onClick={() => setMode('choose')}>返回</button>
          <span />
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={!requirement.trim()} onClick={() => onSubmit(requirement.trim())}>复制并发送到对话框</button>
        </div>
      </>}
    </div>
  </div>
}

function SlideModal({ onClose, onChoose }: {
  onClose: () => void
  onChoose: (format: 'pptx' | 'html') => void
}) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal slide-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>生成 Slides</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      <div className="slide-options">
        <button className="slide-option" onClick={() => onChoose('pptx')}>
          <b>PPTX</b><small>可编辑演示文稿</small>
        </button>
        <button className="slide-option" onClick={() => onChoose('html')}>
          <b>HTML</b><small>网页幻灯片</small>
        </button>
      </div>
      <p className="slide-footnote">选择格式后，粘贴给 Agent 即可生成并回写链接。</p>
    </div>
  </div>
}

function SendModal({ page, onClose, onSendLark }: {
  page: Page
  onClose: () => void
  onSendLark: () => void
}) {
  const [target, setTarget] = useState<'choose' | 'lark'>('choose')
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal send-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>发送</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      {target === 'choose' ? <>
        <div className="send-options">
          <button className="slide-option" onClick={() => setTarget('lark')}>
            <b>飞书</b><small>通过 lark-cli 创建云文档</small>
          </button>
          <button className="slide-option pending" disabled>
            <b>公众号 <em>待完善</em></b><small>暂未开放</small>
          </button>
          <button className="slide-option pending" disabled>
            <b>知乎 <em>待完善</em></b><small>暂未开放</small>
          </button>
        </div>
        <p className="slide-footnote">选择要发送的社交媒体。</p>
      </> : <>
        <div className="send-confirm">
          <b>发送到飞书？</b>
          <p>将当前页面“{page.title}”作为一篇新的飞书云文档推送。</p>
        </div>
        <div className="modal-actions cowrite-actions">
          <button onClick={() => setTarget('choose')}>返回</button>
          <span />
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={onSendLark}>确认并复制发送任务</button>
        </div>
      </>}
    </div>
  </div>
}

function DeletePageModal({ page, onClose, onConfirm }: {
  page: PageMeta
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const confirm = async () => {
    setDeleting(true)
    try { await onConfirm() } finally { setDeleting(false) }
  }
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal delete-modal" role="alertdialog" aria-labelledby="delete-page-title" aria-describedby="delete-page-description" onClick={(event) => event.stopPropagation()}>
      <h2 id="delete-page-title">确定要删除吗？</h2>
      <p id="delete-page-description">页面“{page.title}”删除后无法恢复。</p>
      <div className="modal-actions">
        <button disabled={deleting} onClick={onClose}>取消</button>
        <button className="delete-confirm" disabled={deleting} onClick={confirm}>{deleting ? '删除中…' : '确定删除'}</button>
      </div>
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
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; text: string } | null>(null)
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
      setSelectionBar({ x: rect.left + rect.width / 2, y: rect.top, text })
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
    notify(hint)
  }

  return <>
    <div className="editor-holder" ref={holderRef} />
    {selectionBar && <div className="selection-bar" style={{ left: selectionBar.x, top: selectionBar.y }}>
      <>
            <button title="加粗" onMouseDown={(event) => { event.preventDefault(); wrapSelection('**', '**') }}><b>B</b></button>
            <button title="斜体" onMouseDown={(event) => { event.preventDefault(); wrapSelection('*', '*') }}><i>I</i></button>
            <button title="删除线" onMouseDown={(event) => { event.preventDefault(); wrapSelection('~~', '~~') }}><s>S</s></button>
            <button title="行内代码" onMouseDown={(event) => { event.preventDefault(); wrapSelection('`', '`') }}>{'<>'}</button>
            <button title="引用" onMouseDown={(event) => { event.preventDefault(); wrapSelection('\n> ', '\n') }}>&gt;</button>
            <span className="bar-divider" />
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(illustrateCommand({ pageId, selection: selectionBar.text }), 'Image2 配图口令已复制，结果会插入选中段落下方') }}>配图</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(explainerCommand({ pageId, selection: selectionBar.text }), 'HTML/PPT 解释图口令已复制，结果会插入选中段落下方') }}>HTML</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(polishCommand({ pageId, selection: selectionBar.text }), 'Skill 优化口令已复制，Agent 只会改写这段文字') }}>优化</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); copyAi(conversationCommand({ pageId, selection: selectionBar.text }), '已引用选中文字，粘贴到 Codex 对话框后补充修改要求') }}>对话</button>
          </>
    </div>}
  </>
}

function App() {
  const [pages, setPages] = useState<PageMeta[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [cowriteOpen, setCowriteOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PageMeta | null>(null)
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

  const removePage = async (page: PageMeta) => {
    await api(`/api/pages/${page.id}`, { method: 'DELETE' })
    const list = await refreshList()
    if (activeId === page.id) setActiveId(list[0]?.id ?? null)
    setDeleteTarget(null)
    notify('页面已删除')
  }

  const copyPendingCommand = async () => {
    if (!activePage) return
    const command = await (await fetch(`/api/pages/${activePage.id}/command`)).text()
    await navigator.clipboard.writeText(command)
    notify('口令已复制，粘贴给 Codex / Claude Code')
  }

  const copyPageCreationCommand = async (requirement: string) => {
    if (!activePage) return
    await navigator.clipboard.writeText(pageCreationCommand({ pageId: activePage.id, title: activePage.title, content: activePage.content }, requirement))
    setCowriteOpen(false)
    notify('当前页面和创作要求已复制，请粘贴到 Codex / Claude Code 对话框')
  }

  const copyCurrentPageCreationCommand = async () => {
    await copyPageCreationCommand('以当前页面全文作为创作要求，围绕其中的主题、信息和结构进行创作。')
  }

  const copySlideCommand = async (format: 'pptx' | 'html') => {
    if (!activePage) return
    const input = { pageId: activePage.id, title: activePage.title }
    const command = format === 'pptx' ? slidePptxCommand(input) : slideHtmlCommand(input)
    await navigator.clipboard.writeText(command)
    setSlideOpen(false)
    notify(`${format === 'pptx' ? 'PPT' : 'HTML'} Slide 口令已复制，粘贴给 Agent 后会把结果地址插回当前页面`)
  }

  const copyWechatLayoutCommand = async () => {
    if (!activePage) return
    await navigator.clipboard.writeText(wechatLayoutCommand({ pageId: activePage.id, title: activePage.title }))
    setLayoutOpen(false)
    notify('公众号排版口令已复制，粘贴给 Agent 后会把 HTML 预览地址插回当前页面')
  }

  const copyLayoutCommand = async (format: 'wechat' | 'xhs') => {
    if (format === 'wechat') return copyWechatLayoutCommand()
    if (!activePage) return
    await navigator.clipboard.writeText(xhsLayoutCommand({ pageId: activePage.id, title: activePage.title }))
    setLayoutOpen(false)
    notify('小红书排版口令已复制，Agent 确认方案后会用 Image2 生成图片组并插回当前页面')
  }

  const copyLarkSendCommand = async () => {
    if (!activePage) return
    await navigator.clipboard.writeText(larkSendCommand({
      pageId: activePage.id,
      title: activePage.title,
      content: activePage.content,
    }))
    setSendOpen(false)
    notify('飞书发送任务已复制，请粘贴到 Codex / Claude Code 对话框执行')
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
        {pages.map((page) => <div key={page.id} className={`sidebar-page ${page.id === activeId ? 'active' : ''}`}>
          <button className="sidebar-page-select" onClick={() => setActiveId(page.id)}>
            <span className="doc-icon">▤</span>
            <span className="doc-title">{page.title}</span>
            {page.prompt && page.revision === 1 && <span className="pending-dot" title="等待 Agent 创作" />}
          </button>
          <button className="sidebar-delete" title={`删除 ${page.title}`} aria-label={`删除 ${page.title}`} onClick={() => setDeleteTarget(page)}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6.5v8m3.5-8v8m3.5-8v8M4 4.5h12M7 4.5V2.8h6v1.7m-7.5 0 .7 12.7h7.6l.7-12.7" /></svg>
          </button>
        </div>)}
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
            <button onClick={() => setLayoutOpen(true)} title="把当前 Page 排版为公众号或小红书内容">排版</button>
            <button onClick={() => setSlideOpen(true)} title="把当前 Page 转换为 PPT 或 HTML">Slide</button>
            <button onClick={() => setCowriteOpen(true)} title="根据当前 Page 内容继续创作">Cowrite</button>
            <button onClick={() => setSendOpen(true)} title="把当前 Page 发送到社交媒体">发送</button>
          </div>
        </>}
      </div>
      {activePage?.prompt && activePage.revision === 1 && <div className="prompt-banner">
        <div><b>等待 Agent 创作</b><p>{activePage.prompt}</p></div>
        <button onClick={copyPendingCommand}>复制口令</button>
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
      onClose={() => setSlideOpen(false)}
      onChoose={copySlideCommand}
    />}
    {layoutOpen && activePage && <LayoutModal
      onClose={() => setLayoutOpen(false)}
      onChoose={copyLayoutCommand}
    />}
    {cowriteOpen && activePage && <CowriteModal
      page={activePage}
      onClose={() => setCowriteOpen(false)}
      onUsePage={copyCurrentPageCreationCommand}
      onSubmit={copyPageCreationCommand}
    />}
    {sendOpen && activePage && <SendModal
      page={activePage}
      onClose={() => setSendOpen(false)}
      onSendLark={copyLarkSendCommand}
    />}
    {deleteTarget && <DeletePageModal
      page={deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onConfirm={() => removePage(deleteTarget)}
    />}
    {toast && <div className="toast">✓ {toast}</div>}
  </div>
}

export default App
