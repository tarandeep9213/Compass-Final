import { useState, useMemo, useEffect, useRef } from 'react'
import { AUDIT_EVENTS, LOCATIONS, todayStr } from '../../mock/data'
import type { AuditEvent } from '../../mock/data'
import { listAuditEvents } from '../../api/audit'
import { listLocations } from '../../api/locations'
import type { ApiAuditEvent } from '../../api/types'
import * as XLSX from 'xlsx'

interface Props { adminName: string }

const PAGE_SIZE = 15

function mapApiAuditEvent(e: ApiAuditEvent): AuditEvent {
  return {
    id: e.id,
    eventType: e.event_type,
    actor: e.actor_name,
    actorId: e.actor_id,
    actorRole: e.actor_role,
    locationId: e.location_id ?? undefined,
    entityId: e.entity_id ?? undefined,
    entityType: e.entity_type ?? undefined,
    detail: e.detail,
    timestamp: e.created_at,
    oldValue: e.old_value ?? undefined,
    newValue: e.new_value ?? undefined,
  }
}

const EVENT_LABELS: Record<string, string> = {
  // Submissions
  SUBMISSION_CREATED:            'Submission Created',
  SUBMISSION_SUBMITTED:          'Submission Submitted',
  SUBMISSION_APPROVED:           'Submission Approved',
  SUBMISSION_REJECTED:           'Submission Rejected',
  // Verifications
  CONTROLLER_VERIFIED:           'Controller Verified',
  DGM_VERIFIED:                  'DGM Verified',
  // Users
  USER_LOGIN:                    'User Login',
  USER_CREATED:                  'User Created',
  USER_UPDATED:                  'User Updated',
  USER_DEACTIVATED:              'User Deactivated',
  USER_REACTIVATED:              'User Reactivated',
  PASSWORD_RESET:                'Password Reset',
  // Locations
  LOCATION_CREATED:              'Location Created',
  LOCATION_UPDATED:              'Location Updated',
  LOCATION_DEACTIVATED:          'Location Deactivated',
  LOCATION_REACTIVATED:          'Location Reactivated',
  // Config
  CONFIG_UPDATED:                'Config Updated',
  CONFIG_CHANGED:                'Config Changed',
  CONFIG_LOCATION_OVERRIDE:      'Tolerance Override Set',
  CONFIG_LOCATION_OVERRIDE_REMOVED: 'Tolerance Override Removed',
  // Access grants
  ACCESS_GRANT_CREATED:          'Access Grant Created',
  ACCESS_GRANT_UPDATED:          'Access Grant Updated',
  ACCESS_GRANT_REVOKED:          'Access Grant Revoked',
  // Import
  ROSTER_IMPORT:                 'Roster Imported',
}
const EVENT_COLORS: Record<string, string> = {
  // Submissions — blues
  SUBMISSION_CREATED:            '#e0f2fe',
  SUBMISSION_SUBMITTED:          '#e0f2fe',
  SUBMISSION_APPROVED:           '#f0fdf4',
  SUBMISSION_REJECTED:           '#fff1f2',
  // Verifications — purples/yellows
  CONTROLLER_VERIFIED:           '#fdf4ff',
  DGM_VERIFIED:                  '#fef9c3',
  // Users — teals
  USER_LOGIN:                    '#f0fdfa',
  USER_CREATED:                  '#f0f9ff',
  USER_UPDATED:                  '#e0f2fe',
  USER_DEACTIVATED:              '#fff1f2',
  USER_REACTIVATED:              '#f0fdf4',
  PASSWORD_RESET:                '#fdf4ff',
  // Locations — greens
  LOCATION_CREATED:              '#f0fdf4',
  LOCATION_UPDATED:              '#dcfce7',
  LOCATION_DEACTIVATED:          '#fff1f2',
  LOCATION_REACTIVATED:          '#f0fdf4',
  // Config — oranges
  CONFIG_UPDATED:                '#fff7ed',
  CONFIG_CHANGED:                '#fff7ed',
  CONFIG_LOCATION_OVERRIDE:      '#fff7ed',
  CONFIG_LOCATION_OVERRIDE_REMOVED: '#fff7ed',
  // Access grants — indigos
  ACCESS_GRANT_CREATED:          '#eef2ff',
  ACCESS_GRANT_UPDATED:          '#eef2ff',
  ACCESS_GRANT_REVOKED:          '#fff1f2',
  // Import — slate
  ROSTER_IMPORT:                 '#f8fafc',
}

function pageNums(cur: number, total: number): (number|'gap')[] {
  if (total<=7) return Array.from({length:total},(_,i)=>i)
  if (cur<=3)          return [0,1,2,3,'gap',total-1]
  if (cur>=total-4)    return [0,'gap',total-4,total-3,total-2,total-1]
  return [0,'gap',cur-1,cur,cur+1,'gap',total-1]
}

const SEL: React.CSSProperties = {
  padding:'7px 28px 7px 10px', fontSize:12, fontWeight:600, fontFamily:'inherit',
  border:'1.5px solid var(--ow2)', borderRadius:8, background:'#fff', color:'var(--td)',
  outline:'none', appearance:'none', WebkitAppearance:'none', cursor:'pointer', minWidth:140,
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230d3320' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat', backgroundPosition:'right 9px center',
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function rangeStart(range: string): string {
  const today = new Date()
  if (range === 'today') return todayStr()
  if (range === 'week')  { const d = new Date(today); d.setDate(today.getDate()-6); return localDateStr(d) }
  if (range === 'month') { const d = new Date(today); d.setDate(1); return localDateStr(d) }
  return ''
}


export default function AdmAudit({ adminName }: Props) {
  const [filterType,  setFilterType]  = useState('all')
  const [filterActor, setFilterActor] = useState('all')
  const [filterLoc,   setFilterLoc]   = useState('all')
  const [filterRange, setFilterRange] = useState<'all'|'today'|'week'|'month'|'custom'>('all')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState(todayStr())
  const [page, setPage] = useState(0)

  const [apiEvents, setApiEvents] = useState<AuditEvent[]>([])
  const [apiLocations, setApiLocations] = useState<{ id: string; name: string; cost_center?: string }[]>([])
  const [fetchError, setFetchError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFetchError('')
    listAuditEvents({ page_size: 5000 })
      .then(r => setApiEvents(r.items.map(mapApiAuditEvent)))
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        const isNetworkError = error instanceof TypeError || error.message === 'Failed to fetch' || error.message === 'Network Error';
        if (isNetworkError) {
          setFetchError('Could not reach the server. Make sure the backend is running on port 8000.')
        } else {
          setFetchError(error.message || 'Failed to load audit events.')
        }
      })
    listLocations()
      .then(locs => setApiLocations(locs.map(l => ({ id: l.id, name: l.name, cost_center: l.cost_center }))))
      .catch(() => { /* fall back to mock */ })
  }, [])

  const allLocations = apiLocations.length > 0 ? apiLocations : LOCATIONS.map(l => ({ id: l.id, name: l.name, cost_center: (l as unknown as Record<string, string>).costCenter || (l as unknown as Record<string, string>).cost_center }))

  const sourceEvents = apiEvents.length > 0 ? apiEvents : AUDIT_EVENTS

  // Event types: static from known EVENT_LABELS (don't derive from data)
  const EVENT_TYPES = Object.keys(EVENT_LABELS).sort((a, b) =>
    (EVENT_LABELS[a] ?? a).localeCompare(EVENT_LABELS[b] ?? b)
  )

  useEffect(() => { setPage(0) }, [filterType, filterActor, filterLoc, filterRange, customFrom, customTo])

  // ── Cascading filter options ────────────────────────────────────────────────
  // Derive unique actors from loaded events, narrowed by event type when active
  const availableActors = useMemo(() => {
    const base = filterType === 'all' ? sourceEvents : sourceEvents.filter(e => e.eventType === filterType)
    const seen = new Map<string, string>()
    base.forEach(e => { if (!seen.has(e.actor)) seen.set(e.actor, e.actorId ?? e.actor) })
    return [...seen.entries()]
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [filterType, sourceEvents])

  // Locations derived from loaded events matching current type + actor filters
  const availableLocations = useMemo(() => {
    const locIds = new Set(
      sourceEvents
        .filter(e =>
          (filterType  === 'all' || e.eventType === filterType)  &&
          (filterActor === 'all' || e.actor     === filterActor) &&
          !!e.locationId
        )
        .map(e => e.locationId!)
    )
    return allLocations.filter(l => locIds.has(l.id))
  }, [filterType, filterActor, sourceEvents, allLocations])

  // Auto-reset actor if it no longer appears in the narrowed actor list
  useEffect(() => {
    if (filterActor !== 'all' && !availableActors.some(a => a.name === filterActor))
      setFilterActor('all')
  }, [availableActors, filterActor])

  // Auto-reset location if it no longer appears in the narrowed location list
  useEffect(() => {
    if (filterLoc !== 'all' && !availableLocations.some(l => l.id === filterLoc))
      setFilterLoc('all')
  }, [availableLocations, filterLoc])

  const dateStart = filterRange === 'custom' ? customFrom : rangeStart(filterRange)
  const dateEnd   = filterRange === 'custom' ? customTo  : (filterRange !== 'all' ? todayStr() : '')

  const filtered = useMemo(() =>
    sourceEvents
      .filter(e => {
        if (filterType  !== 'all' && e.eventType !== filterType)   return false
        if (filterActor !== 'all' && e.actor     !== filterActor)  return false
        if (filterLoc   !== 'all' && e.locationId!== filterLoc)    return false
        const dateOnly = e.timestamp.split('T')[0]
        if (dateStart && dateOnly < dateStart) return false
        if (dateEnd   && dateOnly > dateEnd)   return false
        return true
      })
      .sort((a,b) => b.timestamp.localeCompare(a.timestamp)),
  [filterType, filterActor, filterLoc, dateStart, dateEnd, sourceEvents])

  // ── Export Logic ────────────────────────────────────────────────────────
  const formatFilename = (ext: string) => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '')
    return `audit_trail_${date}_${time}.${ext}`
  }

  const getExportData = () => filtered.map(ev => {
    const loc = allLocations.find(l => l.id === ev.locationId)
    const ts = new Date(ev.timestamp)
    return {
      Timestamp: `${ts.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      Event: EVENT_LABELS[ev.eventType] ?? ev.eventType,
      Actor: ev.actor,
      'Location Name': loc?.name ?? '—',
      'Location ID': ev.locationId ?? '—',
      Detail: ev.detail,
      'Old Value': ev.oldValue ?? '—',
      'New Value': ev.newValue ?? '—',
    }
  })

  const exportToFile = (format: 'csv' | 'xlsx') => {
    setIsExporting(true)
    setShowExportMenu(false)
    setTimeout(() => {
      try {
        const data = getExportData()
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Trail')
        if (format === 'csv') {
          XLSX.writeFile(workbook, formatFilename('csv'), { bookType: 'csv' })
        } else {
          XLSX.writeFile(workbook, formatFilename('xlsx'))
        }
      } catch (err) {
        console.error('Export failed', err)
      } finally {
        setIsExporting(false)
      }
    }, 100)
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE)
  const from = filtered.length===0 ? 0 : page*PAGE_SIZE+1
  const to   = Math.min((page+1)*PAGE_SIZE, filtered.length)

  return (
    <div className="fade-up">
      <div className="ph" style={{marginBottom:18}}>
        <div>
          <h2>Audit Trail</h2>
          <p style={{color:'var(--ts)',fontSize:13}}>Immutable log of all system events · {adminName}</p>
        </div>
        <div className="ph-right" style={{gap:12}}>
          <span style={{fontSize:12,color:'var(--ts)'}}>{sourceEvents.length} total events</span>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, opacity: filtered.length === 0 ? 0.5 : 1 }}
              disabled={filtered.length === 0 || isExporting}
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              {isExporting ? '⏳ Generating...' : <>Export <span style={{ fontSize: 8 }}>▼</span></>}
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 5, background: '#fff',
                border: '1px solid var(--ow2)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 100, minWidth: 160, overflow: 'hidden'
              }}>
                <button
                  className="btn-ghost"
                  style={{ display: 'block', width: '100%', padding: '10px 15px', textAlign: 'left', fontSize: 12, border: 'none', cursor: 'pointer' }}
                  onClick={() => exportToFile('csv')}
                >
                  Export as CSV
                </button>
                <button
                  className="btn-ghost"
                  style={{ display: 'block', width: '100%', padding: '10px 15px', textAlign: 'left', fontSize: 12, border: 'none', cursor: 'pointer', borderTop: '1px solid var(--ow2)' }}
                  onClick={() => exportToFile('xlsx')}
                >
                  Export as Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div style={{
          background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>⚠️</span> {fetchError} (Showing mock data)
        </div>
      )}

      <div className="card">
        {/* Filters – row 1: dropdowns */}
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',padding:'12px 20px',borderBottom:'1px solid var(--ow2)',background:'var(--ow)'}}>
          <span style={{fontSize:12,fontWeight:600,color:'var(--td)',marginRight:4}}>Filter:</span>

          <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={SEL}>
            <option value="all">All Event Types</option>
            {EVENT_TYPES.map(t=><option key={t} value={t}>{EVENT_LABELS[t]??t}</option>)}
          </select>

          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <select value={filterActor} onChange={e=>setFilterActor(e.target.value)} style={SEL}>
              <option value="all">All Actors</option>
              {availableActors.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            {filterType !== 'all' && (
              <span style={{fontSize:10,color:'var(--ts)',paddingLeft:2}}>
                {availableActors.length} actor{availableActors.length!==1?'s':''} for this event type
              </span>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)} style={{...SEL, opacity: availableLocations.length===0 ? 0.5 : 1}} disabled={availableLocations.length===0}>
              <option value="all">{availableLocations.length===0 ? 'No locations (event has none)' : 'All Locations'}</option>
              {availableLocations.map(l=><option key={l.id} value={l.id}>{l.name} (CC: {l.cost_center || 'N/A'})</option>)}
            </select>
            {(filterType !== 'all' || filterActor !== 'all') && availableLocations.length > 0 && (
              <span style={{fontSize:10,color:'var(--ts)',paddingLeft:2}}>
                {availableLocations.length} location{availableLocations.length!==1?'s':''} for this selection
              </span>
            )}
          </div>

          {(filterType!=='all'||filterActor!=='all'||filterLoc!=='all'||filterRange!=='all') && (
            <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 12px'}}
              onClick={()=>{setFilterType('all');setFilterActor('all');setFilterLoc('all');setFilterRange('all')}}>✕ Clear all</button>
          )}

          <span style={{marginLeft:'auto',fontSize:12,color:'var(--ts)'}}>
            {filtered.length} of {sourceEvents.length} events
          </span>
        </div>

        {/* Filters – row 2: date range */}
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',padding:'10px 20px',borderBottom:'1px solid var(--ow2)',background:'#fafaf8'}}>
          <span style={{fontSize:12,fontWeight:600,color:'var(--td)',marginRight:4}}>Period:</span>
          {(['all','today','week','month','custom'] as const).map(r => (
            <button key={r} onClick={()=>setFilterRange(r)} style={{
              padding:'5px 14px', fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer', borderRadius:7,
              border: filterRange===r ? '2px solid var(--g4)' : '1.5px solid var(--ow2)',
              background: filterRange===r ? 'var(--g7)' : '#fff',
              color: filterRange===r ? '#fff' : 'var(--td)',
            }}>
              {r==='all'?'All Time':r==='today'?'Today':r==='week'?'Last 7 Days':r==='month'?'This Month':'Custom'}
            </button>
          ))}
          {filterRange==='custom' && (
            <>
              <input type="date" className="f-inp" value={customFrom} max={customTo||todayStr()} onChange={e=>setCustomFrom(e.target.value)} style={{fontSize:12,width:140}}/>
              <span style={{fontSize:13,color:'var(--ts)'}}>→</span>
              <input type="date" className="f-inp" value={customTo} max={todayStr()} onChange={e=>setCustomTo(e.target.value)} style={{fontSize:12,width:140}}/>
            </>
          )}
          {filterRange!=='all' && filterRange!=='custom' && dateStart && (
            <span style={{fontSize:12,color:'var(--ts)',marginLeft:4}}>
              {new Date(dateStart+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(todayStr()+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
            </span>
          )}
        </div>

        <div className="card-body" style={{padding:0}}>
          {filtered.length===0 ? (
            <div style={{padding:'48px 32px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>🔍</div>
              <div style={{fontWeight:600,color:'var(--td)'}}>No events match filters</div>
            </div>
          ) : (
            <>
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{minWidth:160}}>Timestamp</th>
                    <th style={{minWidth:160}}>Event</th>
                    <th>Actor</th>
                    <th>Location</th>
                    <th style={{minWidth:260}}>Detail</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(ev => {
                    const loc = allLocations.find(l=>l.id===ev.locationId)
                    const ts  = new Date(ev.timestamp)
                    return (
                      <tr key={ev.id}>
                        <td style={{whiteSpace:'nowrap'}}>
                          <div style={{fontSize:12,fontWeight:500,color:'var(--td)'}}>{ts.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
                          <div style={{fontSize:11,color:'var(--ts)'}}>{ts.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
                        </td>
                        <td>
                          <span style={{
                            fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:6,letterSpacing:'0.03em',
                            background:EVENT_COLORS[ev.eventType]??'#f5f5f5',color:'var(--td)',whiteSpace:'nowrap',
                          }}>
                            {EVENT_LABELS[ev.eventType]??ev.eventType}
                          </span>
                        </td>
                        <td style={{fontSize:12,fontWeight:500,color:'var(--td)',whiteSpace:'nowrap'}}>{ev.actor}</td>
                        <td style={{fontSize:12,color:'var(--ts)'}}>
                          {loc ? <><div style={{fontWeight:500,color:'var(--td)',fontSize:12}}>{loc.name}</div><div style={{fontSize:10,fontFamily:'monospace'}}>{loc.id}</div></>
                            : ev.locationId ? <span style={{fontFamily:'monospace',fontSize:11}}>{ev.locationId}</span>
                            : <span style={{color:'#bbb'}}>—</span>}
                        </td>
                        <td style={{fontSize:12,color:'var(--td)',maxWidth:280}}>{ev.detail}</td>
                        <td style={{fontSize:11,color:'var(--ts)'}}>
                          {ev.oldValue&&ev.newValue
                            ? <><span style={{color:'var(--red)',textDecoration:'line-through'}}>{ev.oldValue}</span>{' → '}<span style={{color:'var(--g7)',fontWeight:600}}>{ev.newValue}</span></>
                            : <span style={{color:'#bbb'}}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {totalPages>1&&(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'1px solid var(--ow2)',background:'var(--ow)'}}>
                  <span style={{fontSize:12,color:'var(--ts)'}}>Showing {from}–{to} of {filtered.length} events</span>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                    {pageNums(page,totalPages).map((n,i)=>n==='gap'
                      ? <span key={`g${i}`} style={{fontSize:12,color:'var(--ts)',padding:'0 4px'}}>…</span>
                      : <button key={n} onClick={()=>setPage(n)} style={{width:30,height:30,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:page===n?700:400,border:`1px solid ${page===n?'var(--g4)':'var(--ow2)'}`,background:page===n?'var(--g7)':'#fff',color:page===n?'#fff':'var(--tm)'}}>{n+1}</button>
                    )}
                    <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
