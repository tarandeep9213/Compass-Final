import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipContent {
  what: string
  how: string
  formula?: string
  flag?: string
}

interface Props {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: string
  highlight?: 'amber' | 'red' | 'green' | 'gray' | false
  tooltip: TooltipContent
  onClick?: () => void
  selected?: boolean
  style?: React.CSSProperties
  tooltipAlign?: 'left' | 'center' | 'right'
}

export default function KpiCard({ label, value, sub, accent, highlight, tooltip, onClick, selected, style, tooltipAlign = 'center' }: Props) {
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLSpanElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)

  // Dismiss tooltip when clicking outside of the card
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsClicked(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const show = isHovered || isClicked

  // Recalculate tooltip position whenever it becomes visible
  useEffect(() => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const tooltipWidth = 280
      let left = tooltipAlign === 'right'
        ? rect.right - tooltipWidth
        : tooltipAlign === 'left'
        ? rect.left
        : rect.left + rect.width / 2 - tooltipWidth / 2
      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8))
      setTooltipPos({ top: rect.bottom + 8, left })
    }
  }, [show, tooltipAlign])

  return (
    <div
      ref={containerRef}
      className={`kpi${highlight === 'red' ? ' red' : highlight === 'amber' ? ' amber' : highlight === 'green' ? ' green' : highlight === 'gray' ? ' gray' : ''}`}
      onClick={onClick}
      style={{
        position: 'relative',
        zIndex: show ? 50 : 1, // FIX: Elevate the stacking context when tooltip is active so it renders over adjacent cards
        overflow: 'visible', // FIX: Ensure the tooltip can break out of the card container
        cursor: onClick ? 'pointer' : undefined,
        outline: selected ? `2px solid ${accent || '#3b82f6'}` : undefined,
        outlineOffset: selected ? 2 : undefined,
        boxShadow: selected ? `0 0 0 4px ${accent ? accent.replace(')', ', 0.15)').replace('rgb', 'rgba') : 'rgba(59,130,246,0.15)'}` : undefined,
        transition: 'outline 0.1s, box-shadow 0.1s',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <div className="kpi-lbl" style={{ marginBottom: 0, color: accent, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
        <span
          ref={btnRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) => {
            e.stopPropagation(); // Prevents card filter from triggering
            setIsClicked(!isClicked);
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: '50%', fontSize: 9, fontWeight: 800,
            background: '#e2e8f0', color: '#64748b', cursor: 'pointer',
            flexShrink: 0, userSelect: 'none', border: '1px solid #cbd5e1',
          }}
        >
          ?
        </span>
      </div>
      <div className="kpi-val" style={{ color: accent, fontFamily: 'DM Serif Display,serif', fontSize: 26, lineHeight: 1 }}>
        {value}
      </div>
      {sub !== undefined && <div className="kpi-sub" style={{ fontSize: 10, color: 'var(--ts)', marginTop: 3 }}>{sub}</div>}

      {show && tooltipPos && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: tooltipPos.top, left: tooltipPos.left,
            zIndex: 9999, width: 280,
            background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
            boxShadow: '0 12px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            pointerEvents: 'auto', overflow: 'hidden', cursor: 'default',
            textAlign: 'left'
          }}
        >
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {label}
            </div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>WHAT</div>
              <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5 }}>{tooltip.what}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>HOW IT'S CALCULATED</div>
              <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5 }}>{tooltip.how}</div>
            </div>
            {tooltip.formula && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>FORMULA</div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 11, color: '#0f172a',
                  background: '#f1f5f9', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: '6px 10px', lineHeight: 1.6,
                  borderLeft: '3px solid #3b82f6', wordBreak: 'break-all'
                }}>
                  {tooltip.formula}
                </div>
              </div>
            )}
            {tooltip.flag && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, flexShrink: 0 }}>⚠</span>
                <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.45 }}>{tooltip.flag}</div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}