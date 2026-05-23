import React from 'react'

export default function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer select-none">
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        {hint && (
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>
        )}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </label>
  )
}
