import './ui.css'

interface Props {
  icon?: string
  title: string
  subtitle?: string
}

const DEFAULT_ICONS: Record<string, string> = {
  submissions:   '📋',
  drafts:        '📝',
  visits:        '📅',
  locations:     '📍',
  users:         '👥',
  events:        '📜',
  reports:       '📊',
  notifications: '🔔',
  search:        '🔍',
  generic:       '📭',
}

export default function EmptyState({ icon, title, subtitle }: Props) {
  const emoji = icon ?? DEFAULT_ICONS.generic
  return (
    <div className="ui-empty" role="status" aria-label={title}>
      <div className="ui-empty-icon">{emoji}</div>
      <div className="ui-empty-title">{title}</div>
      {subtitle && <div className="ui-empty-sub">{subtitle}</div>}
    </div>
  )
}
