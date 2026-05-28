import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Floating popover near a clicked word. Shows Arabic, English translation,
// and an Add/Remove-from-bank button. Closes on outside click or Esc.
export default function WordPopover({
  selection,
  inBank,
  onAdd,
  onRemove,
  onClose,
}) {
  const popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  // Reset positioning state whenever a different word is selected so we
  // don't briefly flash the popover at the previous position.
  useLayoutEffect(() => {
    setPos((p) => ({ ...p, ready: false }))
  }, [selection?.blockIndex, selection?.wordIndex])

  // Position the popover near the anchor element, clamped to the viewport.
  useLayoutEffect(() => {
    if (!selection) return
    // Indices are integers built from React tree state, but we still
    // escape defensively in case a future caller passes through
    // un-validated values.
    const bi = CSS.escape(String(selection.blockIndex))
    const wi = CSS.escape(String(selection.wordIndex))
    const anchor = document.querySelector(
      `[data-block-index="${bi}"][data-word-index="${wi}"]`,
    )
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const popW = popRef.current?.offsetWidth || 260
    const popH = popRef.current?.offsetHeight || 120
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = rect.bottom + margin
    if (top + popH > vh - margin) {
      // not enough room below, place above
      top = rect.top - popH - margin
    }
    // horizontally center on the anchor, clamp inside viewport
    let left = rect.left + rect.width / 2 - popW / 2
    left = Math.max(margin, Math.min(left, vw - popW - margin))

    setPos({
      top: top + window.scrollY,
      left: left + window.scrollX,
      ready: true,
    })
  }, [selection])

  // Dismiss on outside click / Esc.
  useEffect(() => {
    if (!selection) return
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) {
        // Don't immediately close if the click was on the anchor (so the
        // word's own click handler can act as a toggle).
        const bi = CSS.escape(String(selection.blockIndex))
        const wi = CSS.escape(String(selection.wordIndex))
        const anchor = document.querySelector(
          `[data-block-index="${bi}"][data-word-index="${wi}"]`,
        )
        if (anchor && anchor.contains(e.target)) return
        onClose()
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [selection, onClose])

  if (!selection) return null

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Word translation"
      style={{
        position: 'absolute',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        zIndex: 50,
        visibility: pos.ready ? 'visible' : 'hidden',
      }}
      className="w-[18rem] max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-ink-900 shadow-xl p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="ar text-2xl leading-tight text-slate-900 dark:text-slate-100" dir="rtl">
            {selection.ar}
          </div>
          {selection.en && (
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {selection.en}
            </div>
          )}
          {selection.section?.displayAr && (
            <div className="mt-2 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {selection.section.en || selection.section.displayAr}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ×
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {inBank ? (
          <button
            type="button"
            onClick={onRemove}
            className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-md text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Remove from word bank
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-md text-sm font-medium bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            + Add to word bank
          </button>
        )}
      </div>
    </div>
  )
}
