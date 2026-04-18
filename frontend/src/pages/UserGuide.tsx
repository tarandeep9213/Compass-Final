import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Role } from './Login'
import { getHelpEntries, type HelpEntry } from '../help/manifest'

interface Props {
  role: Role
}

type View =
  | { mode: 'overview' }
  | { mode: 'guide'; entryIdx: number }
  | { mode: 'video'; entryIdx: number }

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string }

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--g0)',
        color: 'var(--g8)',
        border: '1px solid var(--g3)',
        padding: '6px 12px',
        fontSize: 13,
        cursor: 'pointer',
        borderRadius: 6,
      }}
    >
      {label}
    </button>
  )
}

/**
 * Split markdown into logical chunks:
 *  - chunks[0]: everything before the first H2 (title + intro + any pre-H2 prose)
 *  - chunks[1..n]: each starts with "## " so ReactMarkdown renders the H2 naturally
 * The split keeps the "## " prefix in each chunk so headings round-trip correctly.
 */
function splitMarkdownByH2(text: string): string[] {
  return text.split(/\n(?=## )/)
}

/** Extract the H2 heading text from a chunk starting with "## " (for TOC). */
function chunkHeading(chunk: string): string | null {
  const m = chunk.match(/^## (.+)$/m)
  return m ? m[1].trim() : null
}

/** URL-safe anchor for a heading (for in-page links / scrollIntoView). */
function headingToId(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function GuideViewer({ entry, onBack }: { entry: HelpEntry; onBack: () => void }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(entry.guide)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load guide (${r.status})`)
        return r.text()
      })
      .then(text => { if (!cancelled) setLoad({ status: 'ready', text }) })
      .catch(err => { if (!cancelled) setLoad({ status: 'error', message: err.message || 'Failed to load guide' }) })
    return () => { cancelled = true }
  }, [entry.guide])

  const chunks = load.status === 'ready' ? splitMarkdownByH2(load.text) : []
  const intro = chunks[0] ?? ''
  const sections = chunks.slice(1)

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <BackButton onClick={onBack} label="← Back to sections" />
      </div>
      <h2 style={{ fontFamily: 'DM Serif Display, serif', marginBottom: 16 }}>
        {entry.title}
      </h2>

      {load.status === 'loading' && (
        <div className="card" style={{ padding: 24, color: 'var(--ts)' }}>Loading guide…</div>
      )}
      {load.status === 'error' && (
        <div className="card" style={{ padding: 24, color: 'var(--red)' }}>
          Could not load guide: {load.message}
        </div>
      )}
      {load.status === 'ready' && (
        <>
          {/* Table of contents — only render when there are 2+ sections */}
          {sections.length >= 2 && (
            <div
              className="card"
              style={{ padding: '14px 20px', marginBottom: 16, background: 'var(--g0)' }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: 'var(--g8)',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}>
                In this guide
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                {sections.map((s, i) => {
                  const h = chunkHeading(s)
                  if (!h) return null
                  const id = headingToId(h)
                  return (
                    <a
                      key={id + i}
                      href={`#${id}`}
                      onClick={e => {
                        e.preventDefault()
                        const el = document.getElementById(id)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      style={{
                        fontSize: 13,
                        color: 'var(--g7)',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      → {h}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Intro card — H1 + opening paragraphs + hero screenshot */}
          {intro.trim() && (
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <div className="user-guide-body">
                <ReactMarkdown>{intro}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* One card per H2 section */}
          {sections.map((section, i) => {
            const h = chunkHeading(section)
            const id = h ? headingToId(h) : `section-${i}`
            return (
              <div
                key={id + i}
                id={id}
                className="card"
                style={{ padding: 24, marginBottom: 16, scrollMarginTop: 16 }}
              >
                <div className="user-guide-body">
                  <ReactMarkdown>{section}</ReactMarkdown>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function VideoViewer({ entry, onBack }: { entry: HelpEntry; onBack: () => void }) {
  const videos = entry.videos
  const [activeIdx, setActiveIdx] = useState(0)
  const active = videos[activeIdx]

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <BackButton onClick={onBack} label="← Back to sections" />
      </div>
      <h2 style={{ fontFamily: 'DM Serif Display, serif', marginBottom: 16 }}>
        {entry.title} — Video
      </h2>

      {videos.length === 0 && (
        <div className="card" style={{ padding: 24 }}>
          <div
            style={{
              border: '1px dashed var(--g3)',
              borderRadius: 8,
              padding: '64px 24px',
              textAlign: 'center',
              background: 'var(--g0)',
              color: 'var(--g8)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎥</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Video coming soon</div>
            <div style={{ fontSize: 12, color: 'var(--ts)' }}>
              Walkthrough for this section will appear here once published.
            </div>
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <>
          {videos.length > 1 && (
            <div
              className="card"
              style={{ padding: '14px 20px', marginBottom: 16, background: 'var(--g0)' }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: 'var(--g8)',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}>
                Pick a walkthrough
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                        padding: '6px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        borderRadius: 6,
                      }}
                    >
                      🎥 {v.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 24 }}>
            {active && (
              <>
                {videos.length > 1 && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--g8)', marginBottom: 10 }}>
                    {active.label}
                  </div>
                )}
                <video
                  key={active.url}
                  controls
                  src={active.url}
                  style={{ width: '100%', borderRadius: 6 }}
                >
                  Your browser does not support the video tag.
                </video>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SectionBox({ label, icon, subtitle, onClick }: {
  label: string
  icon: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 110,
        background: '#fff',
        border: '1px solid var(--g3)',
        borderRadius: 8,
        padding: '16px 20px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 120ms, box-shadow 120ms',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--g6)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)'
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--g3)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--g8)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--ts)' }}>{subtitle}</div>
    </button>
  )
}

export default function UserGuide({ role }: Props) {
  const entries = getHelpEntries(role)
  const [view, setView] = useState<View>({ mode: 'overview' })

  function backToOverview() {
    setView({ mode: 'overview' })
  }

  return (
    <div className="fade-up">
      {view.mode === 'overview' && (
        <>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', marginBottom: 6 }}>
            User Guide
          </h1>
          <div style={{ color: 'var(--ts)', marginBottom: 24, fontSize: 13 }}>
            Pick a section below to open its guide or video walkthrough.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {entries.map((entry, idx) => (
              <section key={entry.tabLabel}>
                <h3 style={{
                  fontFamily: 'DM Serif Display, serif',
                  margin: '0 0 10px',
                  color: 'var(--g8)',
                }}>
                  {entry.tabLabel}
                </h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <SectionBox
                    icon="📖"
                    label="User Guide"
                    subtitle="Open written guide"
                    onClick={() => setView({ mode: 'guide', entryIdx: idx })}
                  />
                  <SectionBox
                    icon="🎥"
                    label="Video"
                    subtitle={
                      entry.videos.length === 0
                        ? 'Coming soon'
                        : entry.videos.length === 1
                        ? 'Watch walkthrough'
                        : `${entry.videos.length} walkthroughs`
                    }
                    onClick={() => setView({ mode: 'video', entryIdx: idx })}
                  />
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {view.mode === 'guide' && (
        <GuideViewer entry={entries[view.entryIdx]} onBack={backToOverview} />
      )}

      {view.mode === 'video' && (
        <VideoViewer entry={entries[view.entryIdx]} onBack={backToOverview} />
      )}
    </div>
  )
}
