import React, { useEffect, useRef, useState } from 'react'
import Toggle from './Toggle.jsx'
import { stripHarakat } from '../lib/stripHarakat.js'

function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}
function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
function ListIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
function GearIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09c0 .66.39 1.26 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82c.25.61.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09c-.66 0-1.26.39-1.51 1z" />
    </svg>
  )
}
function BookmarkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function Toolbar({
  settings,
  toggle,
  reset,
  sections = [],
  bankCount = 0,
  onOpenBank,
}) {
  const [open, setOpen] = useState(false)
  const [secOpen, setSecOpen] = useState(false)
  const popRef = useRef(null)
  const secRef = useRef(null)

  useEffect(() => {
    if (!open && !secOpen) return
    const onClick = (e) => {
      if (open && popRef.current && !popRef.current.contains(e.target)) setOpen(false)
      if (secOpen && secRef.current && !secRef.current.contains(e.target)) setSecOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSecOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, secOpen])

  const goTo = (id) => {
    setSecOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Update hash without jumping (since we already scrolled smoothly).
      history.replaceState(null, '', `#${id}`)
    }
  }

  return (
    <div data-toolbar className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-ink-900/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-prose mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
            Nūr al-Īḍāḥ
          </h1>
          <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate">
            Kitāb al-Ṭahārah
          </span>
        </div>

        <div className="flex items-center gap-1">
          {sections.length > 0 && (
            <div className="relative" ref={secRef}>
              <button
                type="button"
                onClick={() => setSecOpen((v) => !v)}
                className={[
                  'inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm',
                  'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                  secOpen ? 'bg-slate-100 dark:bg-slate-800' : '',
                ].join(' ')}
                aria-expanded={secOpen}
                aria-haspopup="listbox"
              >
                <ListIcon />
                <span className="hidden sm:inline">Sections</span>
              </button>

              {secOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-ink-900 shadow-lg p-2"
                >
                  {sections.map((s) => {
                    const ar = settings.iraab ? s.displayAr : stripHarakat(s.displayAr)
                    const isChapter = s.kind === 'kitab' || s.kind === 'bab'
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => goTo(s.id)}
                        className={[
                          'w-full text-right px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800',
                          isChapter ? 'mt-1' : '',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'ar block leading-snug',
                            isChapter
                              ? 'text-lg font-bold text-emerald-800 dark:text-emerald-300'
                              : 'text-base text-slate-800 dark:text-slate-100',
                          ].join(' ')}
                          dir="rtl"
                        >
                          {ar}
                        </span>
                        {settings.translation && s.en && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 text-left">
                            {s.en}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenBank}
            className="relative inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={`Open word bank (${bankCount} saved)`}
            title="Word bank"
          >
            <BookmarkIcon />
            <span className="hidden sm:inline">Bank</span>
            {bankCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-emerald-700 text-white text-[11px] font-semibold">
                {bankCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => toggle('dark')}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {settings.dark ? <SunIcon /> : <MoonIcon />}
          </button>

          <div className="relative" ref={popRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={[
                'inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm',
                'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                open ? 'bg-slate-100 dark:bg-slate-800' : '',
              ].join(' ')}
              aria-expanded={open}
              aria-haspopup="dialog"
            >
              <GearIcon />
              <span className="hidden sm:inline">Display</span>
            </button>

            {open && (
              <div
                role="dialog"
                className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-ink-900 shadow-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Display settings</h3>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
                  >
                    Reset
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <Toggle
                    label="Arabic text"
                    hint="Show the original Arabic"
                    checked={settings.arabic}
                    onChange={() => toggle('arabic')}
                  />
                  <Toggle
                    label="Word-by-word translation"
                    hint="English under each Arabic word"
                    checked={settings.wbw}
                    onChange={() => toggle('wbw')}
                  />
                  <Toggle
                    label="Full translation"
                    hint="Block-level English sentence"
                    checked={settings.translation}
                    onChange={() => toggle('translation')}
                  />
                  <Toggle
                    label="I‘rāb (ḥarakāt)"
                    hint="Show diacritical marks on Arabic"
                    checked={settings.iraab}
                    onChange={() => toggle('iraab')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
