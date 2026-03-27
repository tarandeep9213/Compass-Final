import React, { useState, useEffect } from 'react'
import { LOCATIONS, saveStored, formatCurrency } from '../../mock/data'
import type { Location } from '../../mock/data'
import { listLocations, createLocation, updateLocation, deactivateLocation, reactivateLocation, getConfig, updateConfig } from '../../api/admin'
import type { ApiLocation } from '../../api/types'

function mapApiLocation(l: ApiLocation): Location {
  return {
    id: l.id,
    name: l.name,
    cost_center: l.cost_center,
    city: l.city,
    expectedCash: l.expected_cash,
    tolerancePct: l.tolerance_pct,
    effectiveTolerancePct: l.effective_tolerance_pct,
    slaHours: l.sla_hours,
    active: l.active,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }
}

interface Props { adminName: string }

const EMPTY_FORM = { id: '', cost_center: '', name:'', expectedCash:'9575', tolerancePct:'' }
const PAGE_SIZE  = 10

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)          return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4)  return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

const DEFAULTS_INIT: { tolerancePct: string; slaHours: string } = { tolerancePct: '0.5', slaHours: '48' }

export default function AdmLocations({ adminName }: Props) {
  const [locs,     setLocs]     = useState<Location[]>([...LOCATIONS])

  const [mode,     setMode]     = useState<'add'|{id:string}|null>(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [errors,   setErrors]   = useState<Record<string,string>>({})
  const [confirm,  setConfirm]  = useState<string|null>(null)   // id awaiting deactivate confirm
  const [saved,    setSaved]    = useState('')
  const [page,     setPage]     = useState(0)
  const [defaults, setDefaults] = useState<{ tolerancePct: string; slaHours: string }>(() => {
    const saved = localStorage.getItem('compass_location_defaults')
    return saved ? JSON.parse(saved) : DEFAULTS_INIT
  })
  const [defSaved, setDefSaved] = useState(false)
  const [defErrors, setDefErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    listLocations()
      .then(r => setLocs(r.items.map(mapApiLocation)))
      .catch(() => { /* fall back to mock */ })
    getConfig()
      .then(cfg => setDefaults(prev => ({ ...prev, tolerancePct: String(cfg.global.default_tolerance_pct) })))
      .catch(() => { /* keep defaults */ })
  }, [])
  const [filterLoc, setFilterLoc] = useState('')

  const filtered   = filterLoc
    ? locs.filter(l => l.id === filterLoc)
    : locs
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  function openAdd() { setMode('add'); setForm({ ...EMPTY_FORM, tolerancePct: defaults.tolerancePct }); setErrors({}); setPage(0) }
    function openEdit(loc: Location) {
    const list = filterLoc ? filtered : locs
    const idx = list.findIndex(l => l.id === loc.id)
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE))
    setMode({id:loc.id})
    setForm({ id: loc.id, cost_center: loc.cost_center || loc.id, name:loc.name, expectedCash:String(loc.expectedCash), tolerancePct:String(loc.tolerancePct) })
    setErrors({})
    setConfirm(null)
  }
  function cancel() { setMode(null); setErrors({}) }

  function validate() {
    const e: Record<string,string> = {}
    if (mode === 'add' && !form.id.trim()) e.id = 'Cost center required'
    if (mode === 'add' && form.id.trim() && !/^\d+$/.test(form.id.trim())) e.id = 'Cost center must be numeric'
    if (mode === 'add' && locs.some(l => l.id === form.id.trim())) e.id = 'ID must be unique'
    
    if (mode !== 'add' && form.cost_center !== undefined && !form.cost_center.trim()) e.cost_center = 'Cost center required'
    
    if (!form.name.trim()) {
      e.name = 'Name required'
    } else {
      const nameLower = form.name.trim().toLowerCase()
      const isDuplicate = locs.some(l => 
        l.name.toLowerCase() === nameLower && 
        (mode === 'add' || (mode !== null && typeof mode === 'object' && l.id !== mode.id))
      )
      if (isDuplicate) e.name = 'Location name must be unique'
    }
    
    const cash = Number(form.expectedCash)
    if (!form.expectedCash || isNaN(cash) || cash <= 0) e.expectedCash = 'Enter a valid amount'
    const tol = Number(form.tolerancePct)
    if (!form.tolerancePct || isNaN(tol) || tol <= 0 || tol > 20) e.tolerancePct = '1–20%'
    return e
  }

  function syncToStorage(updated: Location[]) {
    LOCATIONS.splice(0, LOCATIONS.length, ...updated)
    saveStored('compass_locations', LOCATIONS)
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (mode === 'add') {
      const newLoc: Location = {
        id: form.id.trim(),
        name: form.name.trim(), city: '',
        expectedCash: Number(form.expectedCash),
        tolerancePct: Number(form.tolerancePct),
        slaHours: Number(defaults.slaHours),
        active: true,
      }
      try {
        const created = await createLocation({ id: newLoc.id, name: newLoc.name, city: '', expected_cash: newLoc.expectedCash, tolerance_pct: newLoc.tolerancePct })
        newLoc.id = created.id
      } catch { /* demo mode */ }
      setLocs(prev => {
        const next = [...prev, newLoc]
        syncToStorage(next)
        setPage(Math.floor((next.length - 1) / PAGE_SIZE))
        return next
      })
      setSaved(`Location "${newLoc.name}" added.`)
    } else if (mode && typeof mode === 'object') {
      try {
        await updateLocation(mode.id, { cost_center: form.cost_center.trim(), name: form.name.trim(), expected_cash: Number(form.expectedCash), tolerance_pct: Number(form.tolerancePct) })
      } catch { /* demo mode */ }
      setLocs(prev => {
        const next = prev.map(l => l.id === (mode as {id:string}).id
          ? { ...l, cost_center: form.cost_center.trim(), name:form.name.trim(), expectedCash:Number(form.expectedCash), tolerancePct:Number(form.tolerancePct) }
          : l
        )
        syncToStorage(next)
        return next
      })
      setSaved('Changes saved.')
    }
    setMode(null)
    setTimeout(() => setSaved(''), 3000)
  }

  async function handleDeactivate(id: string) {
    try { await deactivateLocation(id) } catch { /* demo mode */ }
    setLocs(prev => {
      const next = prev.map(l => l.id===id ? {...l, active:false} : l)
      syncToStorage(next)
      return next
    })
    setConfirm(null)
    setSaved('Location deactivated.')
    setTimeout(() => setSaved(''), 3000)
  }

  async function handleReactivate(id: string) {
    try { await reactivateLocation(id) } catch { /* demo mode */ }
    setLocs(prev => {
      const next = prev.map(l => l.id===id ? {...l, active:true} : l)
      syncToStorage(next)
      return next
    })
    setSaved('Location reactivated.')
    setTimeout(() => setSaved(''), 3000)
  }

  async function handleSaveDefaults() {
    const e: Record<string, string> = {}
    const tol = Number(defaults.tolerancePct)
    if (!defaults.tolerancePct || isNaN(tol) || tol <= 0 || tol > 20) e.tolerancePct = 'Enter 0.1–20%'
    if (Object.keys(e).length > 0) { setDefErrors(e); return }
    setDefErrors({})
    try {
      await updateConfig({ default_tolerance_pct: tol })
      const r = await listLocations()
      setLocs(r.items.map(mapApiLocation))
      setDefSaved(true)
      setTimeout(() => setDefSaved(false), 3000)
    } catch {
      setDefErrors({ form: 'Failed to save defaults. Please try again.' })
    }
  }

  const F = (field: keyof typeof EMPTY_FORM) => (
    <input className="f-inp" value={form[field]}
      onChange={e => { setForm(p=>({...p,[field]:e.target.value})); setErrors(p=>({...p,[field]:''})) }}
      style={{width:'100%',fontSize:13}} />
  )

  return (
    <div className="fade-up">
      <div className="ph" style={{marginBottom:18}}>
        <div>
          <h2>Locations</h2>
          <p style={{color:'var(--ts)',fontSize:13}}>Add, edit and deactivate cashroom locations · {adminName}</p>
        </div>
        <div className="ph-right">
          {saved && <span style={{fontSize:12,color:'var(--g7)',fontWeight:600}}>{saved}</span>}
          <button className="btn btn-primary" onClick={openAdd} disabled={mode==='add'}>+ Add Location</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Locations</span>
          <span className="card-sub">{locs.length} total · {locs.filter(l=>l.active).length} active</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="f-inp"
              value={filterLoc}
              onChange={e => { setFilterLoc(e.target.value); setPage(0) }}
              style={{ fontSize: 12, width: 200 }}
            >
              <option value="">All locations</option>
              {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {filterLoc && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => { setFilterLoc(''); setPage(0) }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="card-body" style={{padding:0}}>
          <table className="dt">
            <thead>
              <tr>
                <th>Cost Center</th><th>Location</th>
                <th style={{textAlign:'right'}}>Imprest Amount</th>
                <th style={{textAlign:'center'}}>Tolerance</th>
                <th style={{textAlign:'center'}}>Status</th>
                <th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Add row */}
              {mode === 'add' && (
                <>
                  <tr style={{background:'var(--g0)'}}>
                    <td><input className="f-inp" value={form.id} inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 12345" onChange={e=>{const v=e.target.value.replace(/\D/g,'');setForm(p=>({...p,id:v}));setErrors(p=>({...p,id:''}))}} style={{width:'100%',fontSize:13}}/>{errors.id&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.id}</div>}</td>
                    <td>{F('name')}{errors.name&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.name}</div>}</td>
                    <td><div style={{position:'relative'}}><span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--ts)',pointerEvents:'none'}}>$</span><input className="f-inp" value={form.expectedCash} onChange={e=>{setForm(p=>({...p,expectedCash:e.target.value}));setErrors(p=>({...p,expectedCash:''}))}} type="number" style={{width:'100%',paddingLeft:22,fontSize:13}}/></div>{errors.expectedCash&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.expectedCash}</div>}</td>
                    <td><div style={{display:'flex',gap:4,alignItems:'center'}}><input className="f-inp" value={form.tolerancePct} onChange={e=>{setForm(p=>({...p,tolerancePct:e.target.value}));setErrors(p=>({...p,tolerancePct:''}))}} type="number" style={{width:70,fontSize:13}}/><span style={{fontSize:12}}>%</span></div>{errors.tolerancePct&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.tolerancePct}</div>}</td>
                    <td/>
                    <td style={{textAlign:'right'}}>
                      <button className="btn btn-primary" style={{fontSize:12,padding:'5px 14px'}} onClick={handleSave}>Save</button>
                      <button className="btn btn-ghost" style={{fontSize:12,marginLeft:6}} onClick={cancel}>Cancel</button>
                    </td>
                  </tr>
                </>
              )}

              {pageRows.map(loc => {
                const isEditing = mode && typeof mode==='object' && mode.id===loc.id
                return (
                  <React.Fragment key={loc.id}>
                    <tr style={{opacity:loc.active?1:0.6}}>
                      <td><span style={{fontFamily:'monospace',fontSize:11,color:'var(--ts)'}}>{loc.cost_center || loc.id}</span></td>
                      <td><span style={{fontWeight:500,fontSize:13}}>{loc.name}</span></td>
                      <td style={{textAlign:'right',fontFamily:'DM Serif Display,serif',fontSize:14}}>{formatCurrency(loc.expectedCash)}</td>
                      <td style={{textAlign:'center',fontSize:13}}>{loc.tolerancePct}%</td>
                      <td style={{textAlign:'center'}}>
                        {loc.active
                          ? <span className="badge" style={{background:'var(--g0)',color:'var(--g7)',border:'1px solid var(--g2)',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>ACTIVE</span>
                          : <span className="badge" style={{background:'var(--ow)',color:'#999',border:'1px solid var(--ow2)',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>INACTIVE</span>}
                      </td>
                      <td style={{textAlign:'right'}}>
                        {loc.active && <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>openEdit(loc)}>Edit</button>}
                        {loc.active
                          ? <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px',marginLeft:4,color:'var(--red)'}} onClick={()=>setConfirm(loc.id)}>Deactivate</button>
                          : <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px',marginLeft:4,color:'var(--g7)'}} onClick={()=>handleReactivate(loc.id)}>Reactivate</button>}
                      </td>
                    </tr>

                    {/* Edit expand row */}
                    {isEditing && (
                      <tr key={loc.id+'-edit'} style={{background:'var(--g0)'}}>
                        <td colSpan={6}>
                          <div style={{display:'flex',gap:14,flexWrap:'wrap',padding:'12px 4px',alignItems:'flex-end'}}>
                            <div style={{flex:'1 1 120px'}}>
                              <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Cost Center</label>
                              {F('cost_center')}{errors.cost_center&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.cost_center}</div>}
                            </div>
                            <div style={{flex:'1 1 180px'}}>
                              <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Name</label>
                              {F('name')}{errors.name&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.name}</div>}
                            </div>
                            <div style={{flex:'1 1 120px'}}>
                              <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Expected Cash</label>
                              <div style={{position:'relative'}}><span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--ts)',pointerEvents:'none'}}>$</span><input className="f-inp" value={form.expectedCash} onChange={e=>{setForm(p=>({...p,expectedCash:e.target.value}));setErrors(p=>({...p,expectedCash:''}))}} type="number" style={{width:'100%',paddingLeft:22,fontSize:13}}/></div>
                              {errors.expectedCash&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.expectedCash}</div>}
                            </div>
                            <div style={{flex:'0 0 100px'}}>
                              <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Tolerance %</label>
                              <div style={{display:'flex',gap:4,alignItems:'center'}}><input className="f-inp" value={form.tolerancePct} onChange={e=>{setForm(p=>({...p,tolerancePct:e.target.value}));setErrors(p=>({...p,tolerancePct:''}))}} type="number" style={{width:70,fontSize:13}}/><span style={{fontSize:12}}>%</span></div>
                              {errors.tolerancePct&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.tolerancePct}</div>}
                            </div>
                            <div style={{display:'flex',gap:8}}>
                              <button className="btn btn-primary" style={{fontSize:12,padding:'7px 18px'}} onClick={handleSave}>Save</button>
                              <button className="btn btn-ghost" style={{fontSize:12}} onClick={cancel}>Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Deactivate confirm row */}
                    {confirm===loc.id && (
                      <tr key={loc.id+'-confirm'} style={{background:'#fff5f5'}}>
                        <td colSpan={6}>
                          <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 4px'}}>
                            <span style={{fontSize:13,color:'var(--red)',fontWeight:600}}>⚠ Deactivate "{loc.name}"? Existing data is preserved.</span>
                            <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 14px',color:'var(--red)',border:'1px solid var(--red)'}} onClick={()=>handleDeactivate(loc.id)}>Yes, Deactivate</button>
                            <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setConfirm(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'1px solid var(--ow2)',background:'var(--ow)'}}>
              <span style={{fontSize:12,color:'var(--ts)'}}>Showing {fromRow}–{toRow} of {filtered.length} locations{filterLoc ? ` (filtered from ${locs.length})` : ''}</span>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                {pageNums(page,totalPages).map((n,i)=>n==='gap'
                  ? <span key={`g${i}`} style={{fontSize:12,color:'var(--ts)',padding:'0 4px'}}>…</span>
                  : <button key={n} onClick={()=>setPage(n as number)} style={{width:30,height:30,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:page===n?700:400,border:`1px solid ${page===n?'var(--g4)':'var(--ow2)'}`,background:page===n?'var(--g7)':'#fff',color:page===n?'#fff':'var(--td)'}}>{(n as number)+1}</button>
                )}
                <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Global Defaults ── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Global Defaults</span>
          <span className="card-sub">Applied to new locations unless overridden per-location</span>
        </div>
        <div className="card-body">
          {defErrors.form && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{defErrors.form}</div>}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)', display: 'block', marginBottom: 4 }}>Default Tolerance %</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="f-inp"
                  type="number"
                  value={defaults.tolerancePct}
                  onChange={e => { setDefaults(p => ({ ...p, tolerancePct: e.target.value })); setDefErrors(p => ({ ...p, tolerancePct: '' })) }}
                  style={{ width: 80, fontSize: 13, borderColor: defErrors.tolerancePct ? 'var(--red)' : undefined }}
                />
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>%</span>
              </div>
              {defErrors.tolerancePct && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{defErrors.tolerancePct}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'center', marginTop: 14 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '7px 18px' }}
                onClick={handleSaveDefaults}
              >
                Save Defaults
              </button>
              {defSaved && <span style={{ fontSize: 12, color: 'var(--g7)', fontWeight: 600 }}>Saved successfully</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
