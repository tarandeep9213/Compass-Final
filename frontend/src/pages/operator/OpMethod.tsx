import { getLocation, formatCurrency, IMPREST } from '../../mock/data'

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function OpMethod({ ctx, onNavigate }: Props) {
  const location = getLocation(ctx.locationId)
  const dateLabel = new Date(ctx.date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const methods = [
    {
      id: 'form',
      icon: '📋',
      title: 'Digital Form',
      subtitle: 'Recommended',
      desc: 'Enter cash counts section by section (A–I). Live running total and variance calculated automatically.',
      badge: 'Most accurate',
      badgeColor: 'badge-green',
      comingSoon: false,
    },
    {
      id: 'excel',
      icon: '📊',
      title: 'Excel Upload',
      subtitle: 'Import file',
      desc: 'Upload your completed Sheboygan-format spreadsheet. Totals are parsed automatically.',
      badge: 'Fast',
      badgeColor: 'badge-gray',
      comingSoon: false,
    },
  ]

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <h2>Choose Entry Method</h2>
          <p>
            <strong>{location?.name}</strong> · {dateLabel}
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('op-start')}>
            ← Back
          </button>
        </div>
      </div>

      {/* Update mode banner */}
      {ctx.submissionId && (
        <div className="alert-info" style={{ marginBottom: 12, background: '#fffde7', border: '1px solid #fcd34d' }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <div style={{ fontSize: 13 }}>
            <strong>Updating existing submission.</strong> Choose your entry method — your previous data will be replaced with the new values.
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="alert-info" style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <div style={{ fontSize: 13 }}>
          Imprest balance for this location: <strong>{formatCurrency(IMPREST)}</strong>.
          Your total fund count will be compared against this to calculate the variance.
        </div>
      </div>

      {/* Method cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {methods.map(m => (
          <div
            key={m.id}
            className="card"
            style={{
              cursor: m.comingSoon ? 'default' : 'pointer',
              transition: 'all 0.15s',
              marginBottom: 0,
              opacity: m.comingSoon ? 0.6 : 1,
            }}
            onClick={() => { if (!m.comingSoon) onNavigate(`op-${m.id}`, { ...ctx, method: m.id }) }}
            onMouseEnter={e => { if (!m.comingSoon) e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}>{m.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{m.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 12 }}>{m.subtitle}</div>
              <span className={`badge ${m.badgeColor}`} style={{ marginBottom: 14 }}>
                <span className="bdot"></span>{m.badge}
              </span>
              <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.6 }}>{m.desc}</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 20, width: '100%' }}
                disabled={m.comingSoon}
                onClick={e => { e.stopPropagation(); if (!m.comingSoon) onNavigate(`op-${m.id}`, { ...ctx, method: m.id }) }}
              >
                {m.comingSoon ? 'Coming Soon' : 'Select →'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sections overview */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Cash Form Sections (A–I)</span>
          <span className="card-sub">All methods capture the same data</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="dt">
            <thead>
              <tr>
                <th>Section</th>
                <th>Description</th>
                <th>Entry type</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['A', 'Currency (Bills)',           '$1 · $2 · $5 · $10 · $20 · $50 · $100', 'Qty × face value'],
                ['B', 'Coins in Counting Machines', '$0.01 · $0.05 · $0.10 · $0.25 · $0.50 · $1', 'Qty × face value'],
                ['C', 'Bagged Coin',                'Dollar · Quarter · Dime · Nickel · Bulker bags', 'Qty × bag value'],
                ['D', 'Unissued Changer Funds',     '4 custom rows',                         'Qty × amount each'],
                ['E', 'Rolled Coin',                'Dollar · Quarter · Dime · Nickel rolls', 'Direct dollar amount'],
                ['F', 'Returned Uncounted Funds',   '3 entries',                             'Direct dollar amount'],
                ['G', 'Mutilated / Foreign',        'Currency + Coin',                       'Direct dollar amount'],
                ['H', 'Changer Funds Outstanding',  'Single entry',                          'Direct dollar amount'],
                ['I', 'Unreimbursed Shortage/Over', 'Shortage & Overage',                   'Net calculated'],
              ].map(([sec, name,, type]) => (
                <tr key={sec}>
                  <td><strong style={{ color: 'var(--g7)' }}>§{sec}</strong></td>
                  <td>{name}</td>
                  <td style={{ fontSize: 12, color: 'var(--ts)' }}>{type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
