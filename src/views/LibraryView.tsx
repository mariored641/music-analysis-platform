import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLibraryStore } from '../store/libraryStore'
import { useScoreStore } from '../store/scoreStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useResearchStore } from '../store/researchStore'
import { parseMusicXml } from '../services/xmlParser'
import { saveFile, loadFile, deleteFile } from '../services/storageService'
import { readSyncFile } from '../services/syncService'
import { LibraryCard } from '../components/library/LibraryCard'
import i18n from '../i18n/index'
import './LibraryView.css'

// Extract XML string from an MXL (compressed MusicXML) file using JSZip (bundled with OSMD)
async function extractXmlFromMxl(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(arrayBuffer)

  // MXL spec: META-INF/container.xml lists the rootfile path
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Invalid MXL: missing META-INF/container.xml')

  const containerXml = await containerFile.async('string')
  const match = containerXml.match(/full-path="([^"]+\.xml)"/i)
  if (!match) throw new Error('Invalid MXL: cannot find rootfile in container.xml')

  const rootFile = zip.file(match[1])
  if (!rootFile) throw new Error(`Invalid MXL: rootfile "${match[1]}" not found in archive`)

  return rootFile.async('string')
}

// Read a music file (XML or MXL) and return the XML string
async function readMusicFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.mxl')) {
    const buf = await file.arrayBuffer()
    return extractXmlFromMxl(buf)
  }
  return file.text()
}

type SortKey = 'title' | 'composer' | 'genre' | 'lastModified' | 'lastOpened' | 'dateAdded'

interface MetaFormState {
  title: string
  composer: string
  genre: string
  year: string
  notes: string
}

export function LibraryView() {
  const { t } = useTranslation()
  const { pieces, activePieceId, addPiece, removePiece, setActive, setView } = useLibraryStore()

  const [sortKey, setSortKey] = useState<SortKey>('lastModified')
  const [filterGenre, setFilterGenre] = useState('')
  const [filterComposer, setFilterComposer] = useState('')
  const [search, setSearch] = useState('')

  // Upload flow
  const [pendingXml, setPendingXml] = useState<string | null>(null)
  const [pendingFileName, setPendingFileName] = useState('')
  const [metaForm, setMetaForm] = useState<MetaFormState>({ title: '', composer: '', genre: '', year: '', notes: '' })
  const [showMetaModal, setShowMetaModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(next)
    localStorage.setItem('map-lang', next)
    document.dir = next === 'he' ? 'rtl' : 'ltr'
  }

  // Derived lists for filter dropdowns
  const allGenres = Array.from(new Set(pieces.map(p => p.genre).filter(Boolean))) as string[]
  const allComposers = Array.from(new Set(pieces.map(p => p.composer).filter(Boolean))) as string[]

  // Filter + sort
  const filtered = pieces
    .filter(p => !filterGenre || p.genre === filterGenre)
    .filter(p => !filterComposer || p.composer === filterComposer)
    .filter(p => !search || `${p.title} ${p.composer} ${p.genre}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortKey) {
        case 'title': return (a.title || '').localeCompare(b.title || '')
        case 'composer': return (a.composer || '').localeCompare(b.composer || '')
        case 'genre': return (a.genre || '').localeCompare(b.genre || '')
        case 'lastOpened': return (b.lastOpened || 0) - (a.lastOpened || 0)
        case 'dateAdded': return (b.dateAdded || 0) - (a.dateAdded || 0)
        case 'lastModified': default: return (b.lastModified || b.lastOpened || 0) - (a.lastModified || a.lastOpened || 0)
      }
    })

  const handleFileSelect = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readMusicFile(file)
    const noteMap = parseMusicXml(text)
    setPendingXml(text)
    setPendingFileName(file.name)
    setMetaForm({
      title: noteMap.metadata.title || '',
      composer: noteMap.metadata.composer || '',
      genre: '',
      year: '',
      notes: '',
    })
    setShowMetaModal(true)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleMetaConfirm = async () => {
    if (!pendingXml || !pendingFileName) return
    const noteMap = parseMusicXml(pendingXml)
    const now = Date.now()
    const id = pendingFileName

    const existing = await loadFile(id)
    if (existing) {
      useAnnotationStore.getState().loadAnnotations(existing.annotations)
      useResearchStore.getState().loadNotes(existing.researchNotes ?? [])
    } else {
      useAnnotationStore.getState().loadAnnotations({})
      useResearchStore.getState().loadNotes([])
      await saveFile(id, pendingXml, {})
    }

    useScoreStore.getState().setXml(pendingXml, id)
    useScoreStore.getState().setNoteMap(noteMap)

    addPiece({
      id,
      title: metaForm.title || noteMap.metadata.title,
      composer: metaForm.composer || noteMap.metadata.composer,
      fileName: pendingFileName,
      totalMeasures: noteMap.metadata.totalMeasures,
      lastOpened: now,
      dateAdded: now,
      lastModified: now,
      key: noteMap.metadata.key,
      timeSignature: noteMap.metadata.timeSignature,
      genre: metaForm.genre || undefined,
      year: metaForm.year ? parseInt(metaForm.year) : undefined,
      notes: metaForm.notes || undefined,
    })

    setActive(id)
    setShowMetaModal(false)
    setPendingXml(null)
    setView('analysis')
  }

  const handleLoadPiece = async (id: string) => {
    const saved = await loadFile(id)
    if (!saved) return

    let annotations = saved.annotations
    let researchNotes = saved.researchNotes ?? []

    // If sync folder is active, check for a newer analysis file
    const syncData = await readSyncFile(id)
    if (syncData) {
      const syncTs = new Date(syncData.savedAt).getTime()
      if (syncTs > saved.savedAt) {
        annotations = syncData.annotations
        researchNotes = syncData.researchNotes
        // Update IndexedDB with the newer sync data
        await saveFile(id, saved.xml, annotations, researchNotes)
      }
    }

    const noteMap = parseMusicXml(saved.xml)
    useScoreStore.getState().setXml(saved.xml, saved.id)
    useScoreStore.getState().setNoteMap(noteMap)
    useAnnotationStore.getState().loadAnnotations(annotations)
    useResearchStore.getState().loadNotes(researchNotes)
    useLibraryStore.getState().updatePiece(id, { lastOpened: Date.now() })
    setActive(id)
    setView('analysis')
  }

  const handleDeletePiece = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm(i18n.language === 'he' ? 'למחוק יצירה זו?' : 'Delete this piece?')) return
    await deleteFile(id)
    removePiece(id)
    if (useScoreStore.getState().fileName === id) {
      useScoreStore.getState().setXml('', '')
    }
  }

  const isHe = i18n.language === 'he'

  return (
    <div className="library-view">
      {/* Header */}
      <div className="library-header">
        <div className="library-header-left">
          <span className="library-logo">MAP</span>
          <span className="library-subtitle">{isHe ? 'ספריית יצירות' : 'Music Library'}</span>
        </div>
        <div className="library-header-right">
          <button className="btn-lang" onClick={toggleLang}>
            {isHe ? 'EN' : 'עב'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="library-toolbar">
        <input
          className="library-search"
          type="search"
          placeholder={isHe ? 'חיפוש...' : 'Search...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="library-toolbar-filters">
          <select className="library-select" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
            <option value="lastModified">{isHe ? 'שינוי אחרון' : 'Last modified'}</option>
            <option value="lastOpened">{isHe ? 'פתיחה אחרונה' : 'Last opened'}</option>
            <option value="dateAdded">{isHe ? 'תאריך הוספה' : 'Date added'}</option>
            <option value="title">{isHe ? 'א-ב' : 'Title A-Z'}</option>
            <option value="composer">{isHe ? 'מחבר' : 'Composer'}</option>
            <option value="genre">{isHe ? "ז'אנר" : 'Genre'}</option>
          </select>
          {allGenres.length > 0 && (
            <select className="library-select" value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
              <option value="">{isHe ? "כל הז'אנרים" : 'All genres'}</option>
              {allGenres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          {allComposers.length > 1 && (
            <select className="library-select" value={filterComposer} onChange={e => setFilterComposer(e.target.value)}>
              <option value="">{isHe ? 'כל המחברים' : 'All composers'}</option>
              {allComposers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <button className="btn-add-piece" onClick={handleFileSelect}>
          + {isHe ? 'יצירה חדשה' : 'Add piece'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.musicxml,.mxl"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Grid */}
      <div className="library-grid">
        {filtered.length === 0 && (
          <div className="library-empty">
            <div className="library-empty-icon">♩</div>
            <div>{isHe ? 'הספריה ריקה. לחץ + כדי להוסיף יצירה.' : 'Library is empty. Click + to add a piece.'}</div>
          </div>
        )}
        {filtered.map(piece => (
          <LibraryCard
            key={piece.id}
            piece={piece}
            isActive={piece.id === activePieceId}
            onClick={() => handleLoadPiece(piece.id)}
            onDelete={(e) => handleDeletePiece(e, piece.id)}
          />
        ))}
      </div>

      {/* Metadata modal */}
      {showMetaModal && (
        <div className="library-modal-overlay" onClick={() => setShowMetaModal(false)}>
          <div className="library-modal" onClick={e => e.stopPropagation()}>
            <div className="library-modal-title">{isHe ? 'פרטי יצירה' : 'Piece details'}</div>
            <div className="library-modal-fields">
              <label>
                <span>{isHe ? 'שם' : 'Title'}</span>
                <input value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} />
              </label>
              <label>
                <span>{isHe ? 'מחבר' : 'Composer'}</span>
                <input value={metaForm.composer} onChange={e => setMetaForm(f => ({ ...f, composer: e.target.value }))} />
              </label>
              <label>
                <span>{isHe ? "ז'אנר" : 'Genre'}</span>
                <input value={metaForm.genre} onChange={e => setMetaForm(f => ({ ...f, genre: e.target.value }))} placeholder={isHe ? 'למשל: bebop, jazz, classical' : 'e.g. bebop, jazz, classical'} />
              </label>
              <label>
                <span>{isHe ? 'שנה' : 'Year'}</span>
                <input value={metaForm.year} onChange={e => setMetaForm(f => ({ ...f, year: e.target.value }))} type="number" placeholder="1947" />
              </label>
              <label className="full-width">
                <span>{isHe ? 'הערות' : 'Notes'}</span>
                <textarea value={metaForm.notes} onChange={e => setMetaForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </label>
            </div>
            <div className="library-modal-actions">
              <button className="btn-cancel" onClick={() => setShowMetaModal(false)}>
                {isHe ? 'ביטול' : 'Cancel'}
              </button>
              <button className="btn-confirm" onClick={handleMetaConfirm}>
                {isHe ? 'פתח יצירה' : 'Open piece'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
