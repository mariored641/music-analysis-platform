import { useEffect, useMemo, useRef, useState } from 'react'
import { useLibraryStore, type LibraryPiece } from '../../store/libraryStore'
import { useUiStore } from '../../store/uiStore'
import { useSyncStore, connectFolder, reauthorize } from '../../services/syncService'
import { deletePiece, importFromFolder, importPiece, isScoreFile, loadSamplePiece, openPiece, readScoreFile, suggestMeta } from '../../services/pieceService'
import { PieceForm } from './PieceForm'
import { Modal } from '../common/Modal'
import { Icon } from '../common/Icon'
import { setLanguage, useHe, useTr } from '../../i18n'
import { FORM_COLORS } from '../../constants/layers'
import { loadThumbnail, onThumbnailChange } from '../../score/thumbnail'
import './library.css'

type SortKey = 'lastModified' | 'lastOpened' | 'dateAdded' | 'title' | 'composer' | 'genre'

export function LibraryView() {
  const tr = useTr()
  const he = useHe()
  const pieces = useLibraryStore(s => s.pieces)
  const sync = useSyncStore()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>(() => (localStorage.getItem('map-lib-sort') as SortKey) || 'lastModified')
  const [genre, setGenre] = useState<string | null>(null)
  const [composer, setComposer] = useState<string>('')
  const [pending, setPending] = useState<{ fileName: string; xml: string; meta: Partial<LibraryPiece> } | null>(null)
  const [editing, setEditing] = useState<LibraryPiece | null>(null)
  const [deleting, setDeleting] = useState<LibraryPiece | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { localStorage.setItem('map-lib-sort', sort) }, [sort])

  const genres = useMemo(() => [...new Set(pieces.map(p => p.genre).filter(Boolean) as string[])].sort(), [pieces])
  const composers = useMemo(() => [...new Set(pieces.map(p => p.composer).filter(Boolean))].sort(), [pieces])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = pieces.filter(p =>
      (!genre || p.genre === genre) && (!composer || p.composer === composer) &&
      (!q || [p.title, p.composer, p.genre, p.notes, p.key].some(v => v?.toString().toLowerCase().includes(q))))
    const cmp: Record<SortKey, (a: LibraryPiece, b: LibraryPiece) => number> = {
      lastModified: (a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0),
      lastOpened: (a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0),
      dateAdded: (a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0),
      title: (a, b) => a.title.localeCompare(b.title, he ? 'he' : 'en'),
      composer: (a, b) => (a.composer || '').localeCompare(b.composer || '') || a.title.localeCompare(b.title),
      genre: (a, b) => (a.genre || '~').localeCompare(b.genre || '~') || a.title.localeCompare(b.title),
    }
    return list.sort(cmp[sort])
  }, [pieces, query, genre, composer, sort, he])

  const handleFiles = async (files: File[]) => {
    const scores = files.filter(f => isScoreFile(f.name))
    if (scores.length === 0) { useUiStore.getState().toast(tr('אפשר להעלות רק קבצי MusicXML / MXL', 'Only MusicXML / MXL files'), 'error'); return }
    try {
      if (scores.length === 1) {
        const xml = await readScoreFile(scores[0])
        setPending({ fileName: scores[0].name, xml, meta: suggestMeta(xml, scores[0].name) })
        return
      }
      for (const f of scores) {
        const xml = await readScoreFile(f)
        await importPiece(f.name, xml, suggestMeta(xml, f.name))
      }
      useUiStore.getState().toast(tr(`נוספו ${scores.length} יצירות`, `Added ${scores.length} pieces`), 'success')
    } catch (e) {
      console.error(e)
      useUiStore.getState().toast(tr('קריאת הקובץ נכשלה', 'Could not read the file'), 'error')
    }
  }

  // drag & drop anywhere
  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { depth++; setDragOver(true) } }
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragOver(false) }
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => { e.preventDefault(); depth = 0; setDragOver(false); handleFiles([...(e.dataTransfer?.files ?? [])]) }
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('dragover', over); window.removeEventListener('drop', drop) }
  })

  const syncAction = async () => {
    if (sync.status === 'needs-permission') { await reauthorize(); return }
    if (sync.status !== 'ready') { if (!(await connectFolder())) return }
    const n = await importFromFolder()
    useUiStore.getState().toast(n ? tr(`יובאו ${n} יצירות מהתיקייה`, `Imported ${n} pieces from the folder`) : tr('התיקייה מסונכרנת — אין יצירות חדשות', 'Folder synced — nothing new'), 'success')
  }

  return (
    <div className="library">
      <header className="lib-header">
        <div className="brand"><span className="logo">MAP</span><span>{tr('ספריית יצירות', 'Music library')}</span></div>
        <div className="lib-search">
          <Icon name="search" size={16} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('חיפוש לפי שם, מלחין, סגנון…', 'Search title, composer, genre…')} />
        </div>
        <div className="lib-actions">
          {sync.status !== 'unsupported' && (
            <button className={`btn ghost${sync.status === 'needs-permission' ? ' warn' : ''}`} onClick={syncAction}
              title={tr('תיקייה במחשב שמסונכרנת עם הספרייה (לשימוש עם קלוד קוד)', 'A folder on your computer synced with the library (for Claude Code)')}>
              <Icon name="folder" />
              {sync.status === 'ready' ? sync.folder : sync.status === 'needs-permission' ? tr('אשר גישה לתיקייה', 'Allow folder access') : tr('תיקיית סנכרון', 'Sync folder')}
              {sync.status === 'ready' && <Icon name="refresh" size={14} />}
            </button>
          )}
          <button className="btn primary" onClick={() => fileRef.current?.click()}><Icon name="upload" />{tr('העלאת יצירה', 'Add piece')}</button>
          <button className="icon-btn" onClick={() => setLanguage(he ? 'en' : 'he')} title={he ? 'English' : 'עברית'}><span className="lang">{he ? 'EN' : 'עב'}</span></button>
          <input ref={fileRef} type="file" hidden multiple accept=".xml,.musicxml,.mxl" onChange={e => { handleFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
        </div>
      </header>

      {pieces.length > 0 && (
        <div className="lib-filters">
          <div className="chips">
            <button className={`chip${!genre ? ' on' : ''}`} onClick={() => setGenre(null)}>{tr('הכל', 'All')} <span className="count">{pieces.length}</span></button>
            {genres.map(g => <button key={g} className={`chip${genre === g ? ' on' : ''}`} onClick={() => setGenre(genre === g ? null : g)}>{g}</button>)}
          </div>
          <div className="lib-selects">
            {composers.length > 1 && (
              <select value={composer} onChange={e => setComposer(e.target.value)}>
                <option value="">{tr('כל המלחינים', 'All composers')}</option>
                {composers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="sort">
              <option value="lastModified">{tr('שונה לאחרונה', 'Last modified')}</option>
              <option value="lastOpened">{tr('נפתח לאחרונה', 'Last opened')}</option>
              <option value="dateAdded">{tr('נוסף לאחרונה', 'Recently added')}</option>
              <option value="title">{tr('שם (א-ב)', 'Title (A–Z)')}</option>
              <option value="composer">{tr('מלחין', 'Composer')}</option>
              <option value="genre">{tr("ז'אנר", 'Genre')}</option>
            </select>
          </div>
        </div>
      )}

      <main className="lib-main">
        {pieces.length === 0 ? (
          <div className="lib-empty">
            <button className="dropzone" onClick={() => fileRef.current?.click()}>
              <Icon name="music" size={44} stroke={1.3} />
              <b>{tr('גרור לכאן קבצי MusicXML', 'Drop MusicXML files here')}</b>
              <span>{tr('או לחץ לבחירת קבצים (.xml, .musicxml, .mxl)', 'or click to choose files (.xml, .musicxml, .mxl)')}</span>
            </button>
            <button className="btn" onClick={async () => openPiece(await loadSamplePiece())}>♩ {tr('נסה עם Donna Lee', 'Try Donna Lee')}</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="lib-none">{tr('לא נמצאו יצירות', 'No pieces found')}</div>
        ) : (
          <div className="grid">
            {shown.map(p => <PieceCard key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => setDeleting(p)} />)}
          </div>
        )}
      </main>

      {dragOver && <div className="drop-overlay"><Icon name="upload" size={40} />{tr('שחרר כדי להוסיף לספרייה', 'Drop to add to the library')}</div>}

      {pending && (
        <PieceForm initial={pending.meta} heading={tr('יצירה חדשה', 'New piece')} submitLabel={tr('הוסף ופתח', 'Add & open')} onClose={() => setPending(null)}
          onSubmit={async m => { const id = await importPiece(pending.fileName, pending.xml, m); setPending(null); openPiece(id) }} />
      )}
      {editing && (
        <PieceForm initial={editing} heading={tr('פרטי היצירה', 'Piece details')} submitLabel={tr('שמור', 'Save')} onClose={() => setEditing(null)}
          onSubmit={m => { useLibraryStore.getState().updatePiece(editing.id, m); setEditing(null) }} />
      )}
      {deleting && (
        <Modal title={tr('מחיקת יצירה', 'Delete piece')} onClose={() => setDeleting(null)} footer={<>
          <button className="btn" onClick={() => setDeleting(null)}>{tr('ביטול', 'Cancel')}</button>
          <button className="btn danger" onClick={async () => { await deletePiece(deleting.id); setDeleting(null) }}>{tr('מחק לצמיתות', 'Delete forever')}</button>
        </>}>
          <p>{tr(`למחוק את "${deleting.title}" וכל הניתוח שלה? אי אפשר לבטל.`, `Delete "${deleting.title}" and all its analysis? This cannot be undone.`)}</p>
        </Modal>
      )}
    </div>
  )
}

function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => loadThumbnail(id).then(d => { if (alive) setSrc(d) })
    load()
    const off = onThumbnailChange(load)
    return () => { alive = false; off() }
  }, [id])
  return src
    ? <div className="card-thumb"><img src={src} alt="" draggable={false} /></div>
    : <div className="card-staff" aria-hidden><span /><span /><span /><span /><span /></div>
}

function genreColor(g?: string) {
  if (!g) return '#b8ad9c'
  let h = 0
  for (const c of g) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return FORM_COLORS[h % FORM_COLORS.length]
}

function PieceCard({ p, onEdit, onDelete }: { p: LibraryPiece; onEdit: () => void; onDelete: () => void }) {
  const tr = useTr()
  const he = useHe()
  const when = p.lastOpened ? new Date(p.lastOpened).toLocaleDateString(he ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' }) : tr('לא נפתח', 'Not opened')
  return (
    <article className="card" onClick={() => openPiece(p.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openPiece(p.id) }}
      style={{ ['--g' as string]: genreColor(p.genre) }}>
      <Thumb id={p.id} />
      <div className="card-body">
        <h3>{p.title}</h3>
        <div className="card-composer">{p.composer || tr('מלחין לא ידוע', 'Unknown composer')}{p.year ? ` · ${p.year}` : ''}</div>
        <div className="card-meta">
          {p.genre && <span className="genre">{p.genre}</span>}
          {p.key && <span>{p.key.replace(' major', '').replace(' minor', 'm')}</span>}
          {p.timeSignature && <span>{p.timeSignature}</span>}
          {p.totalMeasures ? <span>{p.totalMeasures} {tr('תיבות', 'bars')}</span> : null}
        </div>
      </div>
      <div className="card-foot">
        <span><Icon name="tag" size={13} />{p.tagCount ?? 0}</span>
        <span>{when}</span>
      </div>
      <div className="card-actions" onClick={e => e.stopPropagation()}>
        <button className="icon-btn sm" onClick={onEdit} title={tr('עריכה', 'Edit')}><Icon name="edit" size={15} /></button>
        <button className="icon-btn sm" onClick={onDelete} title={tr('מחיקה', 'Delete')}><Icon name="trash" size={15} /></button>
      </div>
    </article>
  )
}
