interface Props {
  status: string
  size?: 'sm' | 'md'
}

interface BadgeConfig {
  label: string
  cls: string
}

const TEST_STATUS_CONFIG: Record<string, BadgeConfig> = {
  DRAFT:     { label: 'Draft',          cls: 'badge badge-gray' },
  SUBMITTED: { label: 'Pending Review', cls: 'badge badge-amber' },
  APPROVED:  { label: 'Approved',       cls: 'badge badge-green' },
  REJECTED:  { label: 'Rejected',       cls: 'badge badge-red' },
}

const ZONE_RESULT_CONFIG: Record<string, BadgeConfig> = {
  TESTED:      { label: 'Tested',      cls: 'badge badge-green' },
  NOT_TESTED:  { label: 'Not Tested',  cls: 'badge badge-red' },
  ISSUE_FOUND: { label: 'Issue Found', cls: 'badge badge-amber' },
}

export default function AlarmStatusBadge({ status, size = 'md' }: Props) {
  const isZoneResult = size === 'sm' && ZONE_RESULT_CONFIG[status]
  const cfg = isZoneResult
    ? ZONE_RESULT_CONFIG[status]
    : TEST_STATUS_CONFIG[status] ?? { label: status, cls: 'badge badge-gray' }

  const smallStyle: React.CSSProperties | undefined = size === 'sm'
    ? { fontSize: 10, padding: '2px 7px' }
    : undefined

  return (
    <span className={cfg.cls} style={smallStyle}>
      <span className="bdot" />
      {cfg.label}
    </span>
  )
}
