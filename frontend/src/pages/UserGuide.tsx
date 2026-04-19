import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Role } from './Login'
import { getHelpEntries, type HelpEntry } from '../help/manifest'

interface Props {
  role: Role
}

interface LoadedEntry {
  entry: HelpEntry
  text: string
  headings: { id: string; label: string }[]
}

type Mode = 'guide' | 'video'

// ── Markdown helpers ───────────────────────────────────────────────────────
function headingToId(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function parseHeadings(text: string): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  const re = /^## (.+)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const label = m[1].trim()
    out.push({ id: headingToId(label), label })
  }
  return out
}

// Convert React children (usually a string) to plain text so we can build a stable id.
function childrenToText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    const c = (children as { props?: { children?: React.ReactNode } }).props?.children
    return c !== undefined ? childrenToText(c) : ''
  }
  return ''
}

// ── Lightbox ───────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, zIndex: 1000, cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
          borderRadius: 6, boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
          padding: '6px 12px', cursor: 'pointer', fontSize: 13,
        }}
      >
        Close (Esc)
      </button>
    </div>
  )
}

// ── Left rail ──────────────────────────────────────────────────────────────
interface LeftRailProps {
  loaded: LoadedEntry[]
  activeEntryIdx: number
  activeHeadingId: string | null
  query: string
  onQueryChange: (q: string) => void
  onPick: (entryIdx: number, headingId?: string) => void
  expanded: Set<number>
  onToggleExpand: (idx: number) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

function LeftRail({
  loaded, activeEntryIdx, activeHeadingId, query, onQueryChange, onPick,
  expanded, onToggleExpand,
  mobileOpen, onCloseMobile,
}: LeftRailProps) {
  const q = query.trim().toLowerCase()

  // Filter entries + headings by search query. Empty query → everything visible.
  const filtered = useMemo(() => {
    if (!q) return loaded.map(le => ({ le, headings: le.headings }))
    return loaded
      .map(le => {
        const tabMatches = le.entry.tabLabel.toLowerCase().includes(q)
        const headings = tabMatches
          ? le.headings
          : le.headings.filter(h => h.label.toLowerCase().includes(q))
        return { le, headings, tabMatches }
      })
      .filter(({ headings, tabMatches }) => tabMatches || headings.length > 0)
  }, [loaded, q])

  return (
    <aside
      style={{
        width: 260, flexShrink: 0,
        position: 'sticky', top: 0, alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
        paddingRight: 4,
      }}
      className={mobileOpen ? 'user-guide-rail-mobile-open' : 'user-guide-rail'}
    >
      {/* Mobile close */}
      <div style={{ display: 'none' }} className="user-guide-rail-mobile-header">
        <button
          onClick={onCloseMobile}
          style={{
            background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer',
            padding: 4, color: 'var(--g8)',
          }}
          aria-label="Close menu"
        >✕</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          className="f-inp"
          type="search"
          placeholder="Search sections…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          style={{ width: '100%', fontSize: 13, height: 34 }}
        />
      </div>

      {/* Entry groups */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ts)', padding: '8px 4px' }}>
            No sections match &ldquo;{query}&rdquo;.
          </div>
        )}
        {filtered.map(({ le, headings }) => {
          const idx = loaded.indexOf(le)
          const isActiveEntry = idx === activeEntryIdx
          // When searching, force-expand so matches are visible. Otherwise honour the user's toggle state.
          const isOpen = q ? true : expanded.has(idx)
          return (
            <div key={le.entry.tabLabel}>
              <button
                onClick={() => {
                  // Clicking the currently-active tab's label just toggles expansion.
                  // Clicking an inactive tab switches to it (and onPick will ensure it's expanded).
                  if (isActiveEntry) {
                    onToggleExpand(idx)
                  } else {
                    onPick(idx)
                  }
                  onCloseMobile()
                }}
                aria-expanded={isOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none', padding: '4px 8px',
                  fontFamily: 'DM Serif Display, serif',
                  fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                  color: isActiveEntry ? 'var(--g8)' : 'var(--tm)',
                  cursor: 'pointer', borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    display: 'inline-block', fontSize: 10, width: 10,
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 120ms',
                    color: 'var(--ts)',
                  }}
                  aria-hidden
                >▶</span>
                <span style={{ flex: 1 }}>{le.entry.tabLabel}</span>
                <span
                  style={{
                    fontSize: 10, fontWeight: 500, color: 'var(--ts)',
                    background: 'var(--g0)', borderRadius: 10,
                    padding: '1px 7px', letterSpacing: 0,
                  }}
                  aria-hidden
                >{headings.length}</span>
              </button>
              {isOpen && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: 4 }}>
                {headings.map(h => {
                  const isActive = isActiveEntry && h.id === activeHeadingId
                  return (
                    <li key={h.id}>
                      <button
                        onClick={() => { onPick(idx, h.id); onCloseMobile() }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          background: isActive ? 'var(--g0)' : 'transparent',
                          color: isActive ? 'var(--g8)' : 'var(--tm)',
                          border: 'none',
                          borderLeft: `2px solid ${isActive ? 'var(--g6)' : 'transparent'}`,
                          padding: '4px 10px', fontSize: 12.5,
                          fontWeight: isActive ? 600 : 400,
                          cursor: 'pointer', borderRadius: '0 4px 4px 0',
                          lineHeight: 1.45,
                        }}
                      >
                        {h.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

// ── Video pane ─────────────────────────────────────────────────────────────
function VideoPane({ entry }: { entry: HelpEntry }) {
  const videos = entry.videos
  const [activeIdx, setActiveIdx] = useState(0)
  const active = videos[activeIdx]

  if (videos.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--g3)', borderRadius: 8,
          padding: '64px 24px', textAlign: 'center',
          background: 'var(--g0)', color: 'var(--g8)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎥</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Video coming soon</div>
        <div style={{ fontSize: 12, color: 'var(--ts)' }}>
          Walkthrough for this section will appear here once published.
        </div>
      </div>
    )
  }

  return (
    <div>
      {videos.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {videos.map((v, i) => {
            const isActive = i === activeIdx
            return (
              <button
                key={v.url}
                onClick={() => setActiveIdx(i)}
                style={{
                  background: isActive ? 'var(--g6)' : '#fff',
                  color: isActive ? '#fff' : 'var(--g8)',
                  fontWeight: isActive ? 700 : 500,
                  border: `1px solid ${isActive ? 'var(--g6)' : 'var(--g3)'}`,
                  padding: '6px 12px', fontSize: 13,
                  cursor: 'pointer', borderRadius: 6,
                }}
              >
                🎥 {v.label}
              </button>
            )
          })}
        </div>
      )}
      {active && (
        <video
          key={active.url}
          controls
          src={active.url}
          style={{ width: '100%', borderRadius: 6 }}
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  )
}

// ── Main pane (guide body with observer) ───────────────────────────────────
function GuideBody({
  text,
  onActiveHeadingChange,
  onImageClick,
  scrollContainerRef,
}: {
  text: string
  onActiveHeadingChange: (id: string | null) => void
  onImageClick: (src: string, alt: string) => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Track which H2 is closest to the top of the viewport.
  useEffect(() => {
    const container = scrollContainerRef.current
    const body = bodyRef.current
    if (!container || !body) return
    const anchors = Array.from(body.querySelectorAll<HTMLElement>('h2[id]'))
    if (anchors.length === 0) { onActiveHeadingChange(null); return }

    const observer = new IntersectionObserver(
      entries => {
        // Pick the one whose top is just below the container top.
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const first = visible[0].target as HTMLElement
          onActiveHeadingChange(first.id || null)
        }
      },
      { root: container, rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    )
    anchors.forEach(a => observer.observe(a))
    // Default: first heading active.
    onActiveHeadingChange(anchors[0].id || null)
    return () => observer.disconnect()
  }, [text, onActiveHeadingChange, scrollContainerRef])

  return (
    <div ref={bodyRef} className="user-guide-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const text = childrenToText(children)
            const id = headingToId(text)
            return <h2 id={id}>{children}</h2>
          },
          img: ({ src, alt }) => {
            const safeSrc = typeof src === 'string' ? src : ''
            const safeAlt = alt ?? ''
            return (
              <img
                src={safeSrc}
                alt={safeAlt}
                onClick={() => safeSrc && onImageClick(safeSrc, safeAlt)}
                style={{ cursor: 'zoom-in' }}
              />
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function UserGuide({ role }: Props) {
  const entries = getHelpEntries(role)
  const [loaded, setLoaded] = useState<LoadedEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeEntryIdx, setActiveEntryIdx] = useState(0)
  const [mode, setMode] = useState<Mode>('guide')
  const [query, setQuery] = useState('')
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedTabs, setExpandedTabs] = useState<Set<number>>(() => new Set([0]))
  const contentRef = useRef<HTMLDivElement>(null)
  const pendingScrollRef = useRef<string | null>(null)

  // Load every role's markdown in parallel so the rail can show all H2s.
  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    Promise.all(entries.map(e =>
      fetch(e.guide)
        .then(r => { if (!r.ok) throw new Error(`${e.tabLabel}: HTTP ${r.status}`); return r.text() })
    ))
      .then(texts => {
        if (cancelled) return
        setLoaded(entries.map((entry, i) => ({
          entry,
          text: texts[i] ?? '',
          headings: parseHeadings(texts[i] ?? ''),
        })))
      })
      .catch(err => { if (!cancelled) setLoadError(err.message || 'Failed to load guides') })
    return () => { cancelled = true }
  // entries identity is stable for a given role
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  // When switching entry + mode=guide, scroll content to top (or to pending heading).
  useEffect(() => {
    if (mode !== 'guide') return
    const target = pendingScrollRef.current
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      if (target) {
        const el = document.getElementById(target)
        if (el && contentRef.current) {
          contentRef.current.scrollTo({
            top: el.offsetTop - 8,
            behavior: 'smooth',
          })
          return
        }
      }
      contentRef.current?.scrollTo({ top: 0 })
    })
  }, [activeEntryIdx, mode, loaded])

  function handlePick(idx: number, headingId?: string) {
    setMode('guide')
    // Whenever a tab is picked (by tab label or heading), make sure it's expanded.
    setExpandedTabs(prev => {
      if (prev.has(idx)) return prev
      const next = new Set(prev)
      next.add(idx)
      return next
    })
    if (idx !== activeEntryIdx) {
      pendingScrollRef.current = headingId ?? null
      setActiveEntryIdx(idx)
    } else if (headingId) {
      const el = document.getElementById(headingId)
      if (el && contentRef.current) {
        contentRef.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
      }
    }
  }

  function handleToggleExpand(idx: number) {
    setExpandedTabs(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const activeLoaded = loaded[activeEntryIdx]
  const activeText = activeLoaded?.text ?? ''

  return (
    <div className="fade-up user-guide-shell">
      <style>{`
        .user-guide-shell {
          display: flex; gap: 24px; align-items: flex-start;
          min-height: calc(100vh - 100px);
        }
        .user-guide-pane {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          max-height: calc(100vh - 60px);
        }
        .user-guide-scroller {
          flex: 1; overflow-y: auto;
          padding-right: 8px;
        }
        .user-guide-mobile-toggle { display: none; }
        @media (max-width: 900px) {
          .user-guide-shell { display: block; }
          .user-guide-rail {
            display: none;
          }
          .user-guide-rail-mobile-open {
            display: block !important;
            position: fixed !important; top: 0; left: 0; bottom: 0;
            width: 280px !important;
            background: #fff;
            box-shadow: 2px 0 16px rgba(0,0,0,0.12);
            z-index: 500;
            padding: 16px;
            max-height: 100vh !important;
          }
          .user-guide-rail-mobile-header { display: flex !important; justify-content: flex-end; margin-bottom: 8px; }
          .user-guide-mobile-toggle { display: inline-flex !important; }
          .user-guide-pane { max-height: none; }
        }
      `}</style>

      <LeftRail
        loaded={loaded}
        activeEntryIdx={activeEntryIdx}
        activeHeadingId={activeHeadingId}
        query={query}
        onQueryChange={setQuery}
        onPick={handlePick}
        expanded={expandedTabs}
        onToggleExpand={handleToggleExpand}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="user-guide-pane">
        {/* Top bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            paddingBottom: 12, marginBottom: 12,
            borderBottom: '1px solid var(--g2)',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn btn-outline user-guide-mobile-toggle"
            onClick={() => setMobileOpen(true)}
            style={{ padding: '6px 10px', fontSize: 13 }}
          >
            ☰ Menu
          </button>
          <h1
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: 22, margin: 0, flex: 1, minWidth: 0,
              color: 'var(--g8)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {activeLoaded?.entry.title ?? 'User Guide'}
          </h1>
          <div style={{ display: 'inline-flex', gap: 0 }}>
            {(['guide', 'video'] as Mode[]).map((m, i) => {
              const isActive = mode === m
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    border: '1px solid var(--g3)',
                    borderLeft: i === 1 ? 'none' : '1px solid var(--g3)',
                    borderRadius: i === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
                    background: isActive ? 'var(--g6)' : '#fff',
                    color: isActive ? '#fff' : 'var(--g8)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {m === 'guide' ? '📖 Guide' : '🎥 Video'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="user-guide-scroller">
          {loadError && (
            <div className="card" style={{ padding: 24, color: 'var(--red)' }}>
              Could not load guide: {loadError}
            </div>
          )}
          {!loadError && loaded.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ts)' }}>Loading guides…</div>
          )}
          {!loadError && activeLoaded && mode === 'guide' && (
            <GuideBody
              text={activeText}
              onActiveHeadingChange={setActiveHeadingId}
              onImageClick={(src, alt) => setLightbox({ src, alt })}
              scrollContainerRef={contentRef}
            />
          )}
          {!loadError && activeLoaded && mode === 'video' && (
            <VideoPane entry={activeLoaded.entry} />
          )}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
