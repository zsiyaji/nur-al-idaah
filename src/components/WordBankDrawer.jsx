import React, { useEffect } from 'react'
import { stripHarakat } from '../lib/stripHarakat.js'
import { downloadCSV, toCSV } from '../lib/csv.js'

function groupItemsByEn(items) {
  // Sub-group items within a word by translation, preserving order of
  // first appearance. Returns [{ en, items: [...] }, ...].
  const seen = new Map()
  for (const it of items) {
    const k = it.en || ''
    if (!seen.has(k)) seen.set(k, [])
    seen.get(k).push(it)
  }
  return Array.from(seen.entries()).map(([en, items]) => ({ en, items }))
}

export default function WordBankDrawer({
  open,
  onClose,
  bank,
  showIraab,
  onJumpToSource,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Lock body scroll while drawer is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const handleExport = () => {
    const headers = ['Arabic', 'Translation', 'Fasl']
    const rows = bank.csvRows.map((r) => [r.ar, r.en, r.fasl])
    const csv = toCSV(headers, rows)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCSV(`nur-al-idah-wordbank-${stamp}.csv`, csv)
  }

  const handleClear = () => {
    if (bank.count === 0) return
    const ok = window.confirm(
      `Clear all ${bank.count} saved word${bank.count === 1 ? '' : 's'} from the bank?`,
    )
    if (ok) bank.clearAll()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-label="Word bank"
        aria-hidden={!open}
        className={[
          'fixed right-0 top-0 z-50 h-full w-full sm:w-[28rem] max-w-full',
          'bg-white dark:bg-ink-900 border-l border-slate-200 dark:border-slate-800',
          'shadow-2xl flex flex-col transition-transform',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Word bank
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bank.count === 0
                ? 'No words saved yet'
                : `${bank.count} ${bank.count === 1 ? 'word' : 'words'} saved`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close word bank"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ×
          </button>
        </header>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleExport}
            disabled={bank.count === 0}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-sm font-medium bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={bank.count === 0}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {bank.groupedBySection.length === 0 && (
            <div className="text-sm text-slate-500 dark:text-slate-400 py-12 text-center">
              Click any Arabic word in the text and choose
              <br />
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                “Add to word bank”
              </span>{' '}
              to start collecting.
            </div>
          )}

          {bank.groupedBySection.map((group) => {
            const arSection = showIraab
              ? group.sectionAr
              : stripHarakat(group.sectionAr || '')
            return (
              <section key={group.sectionId || '__none__'} className="mb-5">
                <h3
                  className="ar text-right text-emerald-800 dark:text-emerald-300 font-semibold text-lg leading-tight"
                  dir="rtl"
                >
                  {arSection || '—'}
                </h3>
                {group.sectionEn && (
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {group.sectionEn}
                  </p>
                )}

                <ul className="mt-2 space-y-2">
                  {group.words.map((w) => {
                    const arDisplay = showIraab
                      ? w.ar
                      : stripHarakat(w.ar || '')
                    const byEn = groupItemsByEn(w.items)
                    return (
                      <li
                        key={w.arBase}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="ar text-2xl text-slate-900 dark:text-slate-100"
                            dir="rtl"
                          >
                            {arDisplay}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              for (const it of w.items) {
                                bank.removeById(it.id)
                              }
                            }}
                            className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                            aria-label="Remove word"
                            title="Remove all entries for this word"
                          >
                            Remove
                          </button>
                        </div>

                        <ul className="mt-1 space-y-1">
                          {byEn.map((g) => (
                            <li
                              key={g.en}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {g.en || (
                                  <span className="italic text-slate-400">
                                    (no translation)
                                  </span>
                                )}
                              </span>
                              <span className="flex flex-wrap gap-1 justify-end">
                                {g.items.map((it, idx) => (
                                  <button
                                    key={it.id}
                                    type="button"
                                    onClick={() => onJumpToSource(it)}
                                    title="Go to source in text"
                                    className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md text-[11px] font-medium border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  >
                                    ↗ {g.items.length > 1 ? idx + 1 : ''}
                                  </button>
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </aside>
    </>
  )
}
