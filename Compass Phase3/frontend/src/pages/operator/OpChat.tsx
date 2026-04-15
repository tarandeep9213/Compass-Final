import { useState, useRef, useEffect } from 'react'
import { getLocation, formatCurrency, IMPREST, SUBMISSIONS } from '../../mock/data'

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

interface Message {
  id: number
  from: 'bot' | 'user'
  text: string
}

// Denomination steps for guided entry
const STEPS = [
  { key: 'a100', label: '$100 bills',     unit: 100,  section: 'A', type: 'qty' },
  { key: 'a50',  label: '$50 bills',      unit: 50,   section: 'A', type: 'qty' },
  { key: 'a20',  label: '$20 bills',      unit: 20,   section: 'A', type: 'qty' },
  { key: 'a10',  label: '$10 bills',      unit: 10,   section: 'A', type: 'qty' },
  { key: 'a5',   label: '$5 bills',       unit: 5,    section: 'A', type: 'qty' },
  { key: 'a2',   label: '$2 bills',       unit: 2,    section: 'A', type: 'qty' },
  { key: 'a1',   label: '$1 bills',       unit: 1,    section: 'A', type: 'qty' },
  { key: 'b100', label: '$1.00 coins',    unit: 1,    section: 'B', type: 'qty' },
  { key: 'b50',  label: '$0.50 halves',   unit: 0.5,  section: 'B', type: 'qty' },
  { key: 'b25',  label: '$0.25 quarters', unit: 0.25, section: 'B', type: 'qty' },
  { key: 'b10',  label: '$0.10 dimes',    unit: 0.10, section: 'B', type: 'qty' },
  { key: 'b5',   label: '$0.05 nickels',  unit: 0.05, section: 'B', type: 'qty' },
  { key: 'b1',   label: '$0.01 pennies',  unit: 0.01, section: 'B', type: 'qty' },
  { key: 'cDollar',  label: 'Dollar bags ($25 each)',   unit: 25,  section: 'C', type: 'qty' },
  { key: 'cQuarter', label: 'Quarter bags ($10 each)', unit: 10,  section: 'C', type: 'qty' },
  { key: 'cDime',    label: 'Dime bags ($5 each)',     unit: 5,   section: 'C', type: 'qty' },
  { key: 'cNickel',  label: 'Nickel bags ($2 each)',   unit: 2,   section: 'C', type: 'qty' },
  { key: 'cBulker',  label: 'Bulkers ($50 each)',      unit: 50,  section: 'C', type: 'qty' },
  { key: 'eDollar',  label: 'Dollar rolls ($ amount)', unit: 1,   section: 'E', type: 'amt' },
  { key: 'eQuarter', label: 'Quarter rolls ($ amount)',unit: 1,   section: 'E', type: 'amt' },
  { key: 'h',        label: 'Changer Funds Outstanding',unit: 1,  section: 'H', type: 'amt' },
]

function sectionName(s: string) {
  const map: Record<string,string> = { A:'Currency (Bills)', B:'Coins in Counting Machines', C:'Bagged Coin', E:'Rolled Coin', H:'Changer Funds Outstanding' }
  return map[s] || s
}

export default function OpChat({ ctx, onNavigate }: Props) {
  const location = getLocation(ctx.locationId)
  const dateLabel = new Date(ctx.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const [step, setStep] = useState(-1)   // -1 = intro, STEPS.length = done
  const [values, setValues] = useState<Record<string, number>>({})
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'bot', text: `Hi! I'll guide you through entering today's cash count for ${location?.name} on ${dateLabel}. I'll ask you for each denomination one at a time.` },
    { id: 1, from: 'bot', text: 'Type "0" for any item you don\'t have. Press Enter or click Send after each answer.' },
    { id: 2, from: 'bot', text: 'Ready? Let\'s start with Section A — Currency (Bills).' },
    { id: 3, from: 'bot', text: 'How many $100 bills do you have? (enter a whole number)' },
  ])
  const [msgId, setMsgId] = useState(4)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Running total
  const runningTotal = STEPS.reduce((sum, s) => {
    const v = values[s.key] ?? 0
    return sum + (s.type === 'qty' ? v * s.unit : v)
  }, 0)

  function pushMsg(from: 'bot' | 'user', text: string) {
    setMessages(prev => [...prev, { id: msgId, from, text }])
    setMsgId(p => p + 1)
  }

  function nextStep(currentIdx: number) {
    const next = currentIdx + 1
    setStep(next)
    if (next >= STEPS.length) {
      // All done
      const variance = runningTotal - IMPREST
      const pct = (variance / IMPREST * 100).toFixed(2)
      const color = Math.abs(parseFloat(pct)) > 5 ? '⚠️' : '✅'
      pushMsg('bot', `All done! Here's your summary:`)
      setTimeout(() => pushMsg('bot',
        `Total Fund: ${formatCurrency(runningTotal)}\nImprest: ${formatCurrency(IMPREST)}\nVariance: ${variance >= 0 ? '+' : ''}${formatCurrency(variance)} (${pct}%) ${color}`
      ), 300)
      setTimeout(() => pushMsg('bot', Math.abs(parseFloat(pct)) > 5
        ? `⚠️ Variance exceeds 5%. You'll need to provide an explanation before submitting.`
        : `Everything looks good! You can now submit for approval.`
      ), 600)
      return
    }
    const nextS = STEPS[next]
    const prevS = STEPS[currentIdx]
    // Section transition?
    if (nextS.section !== prevS.section) {
      setTimeout(() => pushMsg('bot', `Great! Moving to Section ${nextS.section} — ${sectionName(nextS.section)}.`), 200)
      setTimeout(() => pushMsg('bot', `${nextS.type === 'qty'
        ? `How many ${nextS.label} do you have? (enter quantity)`
        : `Enter the total dollar amount for ${nextS.label}:`}`
      ), 500)
    } else {
      pushMsg('bot', nextS.type === 'qty'
        ? `How many ${nextS.label} do you have?`
        : `Enter the total dollar amount for ${nextS.label}:`)
    }
  }

  function handleSend() {
    const raw = input.trim()
    if (!raw) return
    const num = parseFloat(raw)
    if (isNaN(num) || num < 0) {
      pushMsg('bot', 'Please enter a valid number (0 or greater).')
      return
    }
    const currentStep = step === -1 ? 0 : step
    if (step === -1) setStep(0)
    pushMsg('user', raw)
    setInput('')
    const s = STEPS[currentStep]
    const amount = s.type === 'qty' ? num * s.unit : num
    setValues(prev => ({ ...prev, [s.key]: num }))
    if (amount > 0) {
      pushMsg('bot', `Got it — ${s.type === 'qty' ? `${num} × ${formatCurrency(s.unit)}` : ''} = ${formatCurrency(amount)} ✓`)
    } else {
      pushMsg('bot', 'OK, none for that one.')
    }
    setTimeout(() => nextStep(currentStep), 300)
  }

  function handleSubmit() {
    const variance = runningTotal - IMPREST
    const variancePct = Math.round((variance / IMPREST) * 10000) / 100
    const newId = `SUB-${Date.now()}`
    SUBMISSIONS.push({
      id: newId, locationId: ctx.locationId, operatorName: 'A. Patel',
      date: ctx.date, status: 'pending_approval', source: 'CHAT',
      totalCash: Math.round(runningTotal * 100) / 100,
      expectedCash: IMPREST,
      variance: Math.round(variance * 100) / 100,
      variancePct,
      submittedAt: new Date().toISOString(),
      sections: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 },
    })
    onNavigate('op-readonly', { locationId: ctx.locationId, date: ctx.date, submissionId: newId })
  }

  const isDone = step >= STEPS.length

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <h2>Guided Chat Entry</h2>
          <p><strong>{location?.name}</strong> · {dateLabel}</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('op-method', ctx)}>← Change method</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Chat window */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-title">💬 Cash Count Assistant</span>
            <span className="card-sub">Screen 5 of 22</span>
          </div>
          <div style={{ height: 420, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(m => (
              <div key={m.id} style={{
                display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                  background: m.from === 'user' ? 'var(--g7)' : '#fff',
                  color: m.from === 'user' ? '#fff' : 'var(--td)',
                  border: m.from === 'bot' ? '1px solid var(--ow2)' : 'none',
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line',
                  borderBottomRightRadius: m.from === 'user' ? 4 : 12,
                  borderBottomLeftRadius: m.from === 'bot' ? 4 : 12,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {!isDone ? (
            <div style={{ borderTop: '1px solid var(--ow2)', padding: 12, display: 'flex', gap: 8 }}>
              <input
                type="number" min="0" step="any" className="f-inp" placeholder="Enter number..."
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                style={{ flex: 1 }}
                autoFocus
              />
              <button className="btn btn-primary" onClick={handleSend}>Send →</button>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--ow2)', padding: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSubmit}>✓ Submit for Approval</button>
              <button className="btn btn-outline" onClick={() => onNavigate('op-form', ctx)}>📋 Switch to Form</button>
            </div>
          )}
        </div>

        {/* Running total sidebar */}
        <div style={{ position: 'sticky', top: 70 }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header"><span className="card-title">Running Total</span></div>
            <div className="card-body">
              <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 28, color: 'var(--g7)', marginBottom: 6 }}>
                {formatCurrency(runningTotal)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ts)', marginBottom: 12 }}>
                vs Imprest {formatCurrency(IMPREST)}
              </div>
              {runningTotal > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--ts)' }}>Variance</span>
                    <span style={{
                      fontWeight: 600,
                      color: Math.abs(runningTotal - IMPREST) > IMPREST * 0.05 ? 'var(--red)' : 'var(--g7)'
                    }}>
                      {runningTotal - IMPREST >= 0 ? '+' : ''}{formatCurrency(runningTotal - IMPREST)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--ow2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min(100, (runningTotal / IMPREST) * 100)}%`,
                      background: Math.abs(runningTotal - IMPREST) > IMPREST * 0.05 ? 'var(--red)' : 'var(--g5)',
                    }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="card">
            <div className="card-header"><span className="card-title">Progress</span></div>
            <div className="card-body">
              <div style={{ fontSize: 12, color: 'var(--ts)', marginBottom: 10 }}>
                {Math.max(0, step)} of {STEPS.length} items
              </div>
              {['A','B','C','E','H'].map(sec => {
                const secSteps = STEPS.filter(s => s.section === sec)
                const doneCount = secSteps.filter(s => values[s.key] !== undefined).length
                return (
                  <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                      background: doneCount === secSteps.length ? 'var(--g1)' : doneCount > 0 ? 'var(--amb-bg)' : 'var(--ow2)',
                      color: doneCount === secSteps.length ? 'var(--g8)' : doneCount > 0 ? '#92400e' : 'var(--ts)',
                    }}>{sec}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--ts)' }}>{sectionName(sec)}</div>
                      <div style={{ height: 3, background: 'var(--ow2)', borderRadius: 2, marginTop: 3 }}>
                        <div style={{ height: '100%', borderRadius: 2, background: doneCount === secSteps.length ? 'var(--g5)' : 'var(--amb)', width: `${(doneCount/secSteps.length)*100}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ts)' }}>{doneCount}/{secSteps.length}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
