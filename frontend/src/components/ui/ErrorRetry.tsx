import './ui.css'
import Spinner from './Spinner'

interface Props {
  message?: string
  onRetry?: () => void
  retrying?: boolean
}

export default function ErrorRetry({
  message = 'Could not load data. Please try again.',
  onRetry,
  retrying = false,
}: Props) {
  return (
    <div className="ui-error" role="alert">
      <span className="ui-error-icon">⚠️</span>
      <div className="ui-error-body">
        <div className="ui-error-msg">{message}</div>
        {onRetry && (
          <button
            className="ui-error-retry"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? <><Spinner size="sm" /> Retrying…</> : '↻ Retry'}
          </button>
        )}
      </div>
    </div>
  )
}
