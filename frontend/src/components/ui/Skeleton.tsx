import './ui.css'

interface BarProps {
  width?: string | number
  height?: number
  style?: React.CSSProperties
}

export function SkeletonBar({ width = '100%', height = 14, style }: BarProps) {
  return (
    <span
      className="skeleton-bar"
      style={{ width, height, display: 'block', ...style }}
      aria-hidden="true"
    />
  )
}

/** A full card-body skeleton — rows of varying widths mimicking a data table */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  const widths = ['100%', '85%', '92%', '78%', '96%', '88%', '75%', '90%']
  return (
    <div className="ui-loading-card" aria-label="Loading data" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SkeletonBar width={24} height={12} />
          <SkeletonBar width={widths[i % widths.length]} height={12} />
          <SkeletonBar width={72} height={12} />
        </div>
      ))}
    </div>
  )
}

/** Row of KPI card skeletons */
export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-row" aria-label="Loading" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi" style={{ gap: 8, display: 'flex', flexDirection: 'column' }}>
          <SkeletonBar width="60%" height={11} />
          <SkeletonBar width="45%" height={26} />
          <SkeletonBar width="50%" height={10} />
        </div>
      ))}
    </div>
  )
}

export default SkeletonBar
