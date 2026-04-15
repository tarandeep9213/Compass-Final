interface Props {
  tested: number
  notTested: number
  issues: number
  total: number
  showLegend?: boolean
  width?: number | string
}

export default function ZoneSummaryBar({ tested, notTested, issues, total, showLegend = false, width = '100%' }: Props) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          background: 'var(--ow2)',
        }}
      >
        {total > 0 && (
          <>
            {tested > 0 && (
              <div style={{ width: `${pct(tested)}%`, background: '#3a9458', transition: 'width 0.3s' }} />
            )}
            {issues > 0 && (
              <div style={{ width: `${pct(issues)}%`, background: '#d97706', transition: 'width 0.3s' }} />
            )}
            {notTested > 0 && (
              <div style={{ width: `${pct(notTested)}%`, background: '#dc2626', transition: 'width 0.3s' }} />
            )}
          </>
        )}
      </div>

      {showLegend && (
        <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 11 }}>
          <span style={{ color: '#3a9458' }}>{tested} tested</span>
          <span style={{ color: '#6b7280' }}>&middot;</span>
          <span style={{ color: '#d97706' }}>{issues} issues</span>
          <span style={{ color: '#6b7280' }}>&middot;</span>
          <span style={{ color: '#dc2626' }}>{notTested} not tested</span>
        </div>
      )}
    </div>
  )
}
