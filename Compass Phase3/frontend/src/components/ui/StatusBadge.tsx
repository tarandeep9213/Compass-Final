import './ui.css'

export type BadgeStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'overdue'
  | 'completed'
  | 'missed'
  | 'cancelled'
  | 'active'
  | 'inactive'

interface Config {
  label: string
  cls: string
  dot?: boolean
  icon?: string
}

const CONFIG: Record<BadgeStatus, Config> = {
  draft:            { label: 'Draft',            cls: 'badge badge-amber', dot: true },
  pending_approval: { label: 'Pending Approval', cls: 'badge badge-amber', dot: true },
  approved:         { label: 'Approved',         cls: 'badge badge-green', dot: true },
  rejected:         { label: 'Rejected',         cls: 'badge badge-red',   dot: true },
  scheduled:        { label: 'Scheduled',        cls: 'badge badge-blue',  icon: '📅' },
  overdue:          { label: 'Overdue',          cls: 'badge badge-amber', icon: '⚠️' },
  completed:        { label: 'Completed',        cls: 'badge badge-green', dot: true },
  missed:           { label: 'Missed',           cls: 'badge badge-red',   dot: true },
  cancelled:        { label: 'Cancelled',        cls: 'badge badge-gray',  dot: true },
  active:           { label: 'Active',           cls: 'badge badge-green', dot: true },
  inactive:         { label: 'Inactive',         cls: 'badge badge-gray',  dot: true },
}

interface Props {
  status: BadgeStatus | string
  /** Override the default label */
  label?: string
  /** Force overdue style for a scheduled visit that is past its date */
  overdue?: boolean
}

export default function StatusBadge({ status, label, overdue }: Props) {
  const key = overdue && status === 'scheduled' ? 'overdue' : (status as BadgeStatus)
  const cfg = CONFIG[key] ?? { label: status, cls: 'badge badge-gray', dot: true }
  const text = label ?? cfg.label

  return (
    <span className={cfg.cls}>
      {cfg.icon
        ? <span style={{ fontSize: 10 }}>{cfg.icon}</span>
        : cfg.dot && <span className="bdot" />
      }
      {text}
    </span>
  )
}
