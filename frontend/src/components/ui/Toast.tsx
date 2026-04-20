import { useState, useEffect } from 'react'
import './ui.css'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

// ── Module-level event bus (no React context needed) ──────────────────────
type Listener = (item: ToastItem) => void
const _listeners: Listener[] = []
let _nextId = 0

function _emit(item: ToastItem) {
  _listeners.forEach(fn => fn(item))
}

// eslint-disable-next-line react-refresh/only-export-components
export const toast = {
  success: (message: string) => _emit({ id: _nextId++, type: 'success', message }),
  error:   (message: string) => _emit({ id: _nextId++, type: 'error',   message }),
  info:    (message: string) => _emit({ id: _nextId++, type: 'info',    message }),
}

// ── Constants ─────────────────────────────────────────────────────────────
const AUTO_DISMISS_MS = 4000

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'i',
}

// ── ToastContainer — mount once in App.tsx ────────────────────────────────
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(item: ToastItem) {
      setItems(prev => [...prev, item])
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== item.id))
      }, AUTO_DISMISS_MS)
    }
    _listeners.push(onToast)
    return () => {
      const idx = _listeners.indexOf(onToast)
      if (idx >= 0) _listeners.splice(idx, 1)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
      {items.map(item => (
        <div key={item.id} className={`toast toast-${item.type}`}>
          <span className="toast-icon">{ICONS[item.type]}</span>
          <span className="toast-message">{item.message}</span>
          <button
            className="toast-close"
            onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
            aria-label="Dismiss"
          >✕</button>
        </div>
      ))}
    </div>
  )
}
