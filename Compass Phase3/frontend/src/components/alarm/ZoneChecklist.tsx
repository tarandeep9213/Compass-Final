import { useState } from 'react'
import type { AlarmZone } from '../../mock/alarmData'

type ZoneResult = 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'

export interface ZoneResultData {
  result: ZoneResult
  notes: string
}

interface Props {
  zones: AlarmZone[]
  results: Record<string, ZoneResultData>
  onChange?: (zoneId: string, result: ZoneResult, notes: string) => void
  readOnly?: boolean
  highlightMissing?: boolean
}

const ZONE_TYPE_LABELS: Record<string, string> = {
  ENTRY_EXIT: 'Entry / Exit Doors',
  INTERIOR_MOTION: 'Interior Motion Sensors',
  PANIC_SILENT: 'Panic Buttons / Silent Alarms',
  HOLDUP: 'Hold-Up Alarms',
  FIRE_SMOKE: 'Fire / Smoke Detectors',
  OTHER: 'Other',
}

const ZONE_TYPE_ORDER = ['ENTRY_EXIT', 'INTERIOR_MOTION', 'PANIC_SILENT', 'HOLDUP', 'FIRE_SMOKE', 'OTHER']

const PILLS: { value: ZoneResult; label: string; selected: React.CSSProperties; }[] = [
  {
    value: 'TESTED',
    label: 'Tested',
    selected: { background: '#d6f0dc', color: '#1a4d30', borderColor: '#3a9458' },
  },
  {
    value: 'NOT_TESTED',
    label: 'Not Tested',
    selected: { background: '#fef2f2', color: '#991b1b', borderColor: '#dc2626' },
  },
  {
    value: 'ISSUE_FOUND',
    label: 'Issue',
    selected: { background: '#fffbeb', color: '#92400e', borderColor: '#d97706' },
  },
]

export default function ZoneChecklist({ zones, results, onChange, readOnly = false, highlightMissing = false }: Props) {
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  // Group zones by type
  const grouped: Record<string, AlarmZone[]> = {}
  for (const z of zones) {
    if (!grouped[z.zoneType]) grouped[z.zoneType] = []
    grouped[z.zoneType].push(z)
  }

  // Sort groups by defined order
  const orderedTypes = ZONE_TYPE_ORDER.filter((t) => grouped[t])

  const toggleNotes = (zoneId: string) => {
    setExpandedNotes((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }))
  }

  return (
    <div>
      {orderedTypes.map((type) => {
        const groupZones = grouped[type]
        return (
          <div key={type}>
            {/* Section header */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--g7)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                padding: '12px 0 6px',
                borderBottom: '1px solid var(--ow2)',
              }}
            >
              {ZONE_TYPE_LABELS[type] ?? type} ({groupZones.length})
            </div>

            {/* Zone rows */}
            {groupZones.map((zone) => {
              const r = results[zone.id]
              const result = r?.result ?? 'NOT_TESTED'
              const notes = r?.notes ?? ''
              const isExpanded = expandedNotes[zone.id] ?? false

              const needsHighlight = highlightMissing && result === 'NOT_TESTED'
              const issueHighlight = highlightMissing && result === 'ISSUE_FOUND'

              return (
                <div key={zone.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom: '1px solid var(--ow2)',
                      ...(needsHighlight
                        ? { borderLeft: '4px solid var(--red)', paddingLeft: 8 }
                        : issueHighlight
                        ? { borderLeft: '4px solid var(--amb)', paddingLeft: 8 }
                        : {}),
                    }}
                  >
                    {/* Zone number badge — large tap target for mobile */}
                    <span
                      style={{
                        display: 'inline-flex',
                        minWidth: 40,
                        height: 36,
                        borderRadius: 8,
                        background: 'var(--g0)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--g7)',
                        flexShrink: 0,
                      }}
                    >
                      {zone.zoneNumber}
                    </span>

                    {/* Zone name */}
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
                      {zone.zoneName}
                    </span>

                    {/* Area badge */}
                    {zone.areaNumber > 1 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--ow)',
                          color: 'var(--ts)',
                          flexShrink: 0,
                        }}
                      >
                        Area {zone.areaNumber}
                      </span>
                    )}

                    {!readOnly ? (
                      <>
                        {/* Radio pills */}
                        {/* Radio pills — large touch-friendly targets for mobile */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {PILLS.map((pill) => {
                            const isSelected = result === pill.value
                            return (
                              <button
                                key={pill.value}
                                type="button"
                                onClick={() => onChange?.(zone.id, pill.value, notes)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 20,
                                  border: '1.5px solid var(--ow2)',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  background: 'transparent',
                                  color: 'var(--tm)',
                                  transition: 'all 0.15s',
                                  minHeight: 40,
                                  ...(isSelected ? pill.selected : {}),
                                }}
                              >
                                {pill.label}
                              </button>
                            )
                          })}
                        </div>

                        {/* Expand arrow for notes */}
                        <button
                          type="button"
                          onClick={() => toggleNotes(zone.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: 'var(--ts)',
                            padding: '2px 4px',
                            flexShrink: 0,
                          }}
                        >
                          {isExpanded ? '\u25B2' : '\u25BC'}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Read-only result icon */}
                        {result === 'TESTED' && (
                          <span style={{ color: '#3a9458', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{'\u2713'}</span>
                        )}
                        {result === 'NOT_TESTED' && (
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{'\u2717'}</span>
                        )}
                        {result === 'ISSUE_FOUND' && (
                          <span style={{ color: '#d97706', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{'\u26A0'}</span>
                        )}

                        {/* Read-only notes inline */}
                        {notes && (
                          <span style={{ fontSize: 12, color: 'var(--ts)', fontStyle: 'italic', flex: 'none', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {notes}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Expanded notes textarea */}
                  {!readOnly && isExpanded && (
                    <div style={{ paddingLeft: 44, paddingBottom: 8 }}>
                      <textarea
                        className="f-ta"
                        placeholder="Add notes..."
                        value={notes}
                        onChange={(e) => onChange?.(zone.id, result, e.target.value)}
                        style={{ width: '100%', marginTop: 6 }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
