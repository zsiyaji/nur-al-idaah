import React from 'react'
import { useToasts } from '../lib/notify.js'

const KIND_STYLES = {
  info:    'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
  success: 'bg-emerald-700 text-white',
  warn:    'bg-amber-600 text-white',
  error:   'bg-red-700 text-white',
}

export default function Toast() {
  const { items, dismiss } = useToasts()
  if (items.length === 0) return null
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto rounded-lg px-4 py-2 text-sm shadow-lg max-w-[90vw]',
            KIND_STYLES[t.kind] || KIND_STYLES.info,
          ].join(' ')}
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="ml-3 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
