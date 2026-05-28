import React from 'react'
import { stripHarakat } from '../lib/stripHarakat.js'

export default function ArabicWord({
  ar,
  en,
  showWbw,
  showIraab,
  blockIndex,
  wordIndex,
  inBank,
  onClick,
}) {
  const arabic = showIraab ? ar : stripHarakat(ar)

  const handleClick = (e) => {
    e.stopPropagation()
    if (onClick) onClick(e)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onClick) onClick(e)
    }
  }

  const commonProps = {
    role: 'button',
    tabIndex: 0,
    onClick: handleClick,
    onKeyDown: handleKey,
    'data-block-index': blockIndex,
    'data-word-index': wordIndex,
    'data-in-bank': inBank ? 'true' : 'false',
  }

  if (showWbw) {
    return (
      <span
        {...commonProps}
        className={[
          'word inline-flex flex-col items-center mx-1.5 mb-3 align-top cursor-pointer rounded-md px-1 py-0.5',
          'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors',
          inBank
            ? 'ring-1 ring-emerald-500/60 dark:ring-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-950/30'
            : '',
        ].join(' ')}
      >
        <span className="word-ar ar text-[1.65rem] md:text-[1.9rem] text-slate-800 dark:text-slate-100 transition-colors">
          {arabic}
        </span>
        <span className="word-en mt-1 text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-snug max-w-[10rem] text-center">
          {en}
        </span>
      </span>
    )
  }

  return (
    <span
      {...commonProps}
      className={[
        'word ar relative inline-block mx-1.5 text-[1.65rem] md:text-[1.9rem] text-slate-800 dark:text-slate-100 cursor-pointer rounded-md px-0.5 transition-colors',
        'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
        inBank
          ? 'ring-1 ring-emerald-500/60 dark:ring-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-950/30'
          : '',
      ].join(' ')}
    >
      {arabic}
      {/* Hover tooltip (desktop hover-capable devices only; styled via CSS) */}
      <span
        className="word-tooltip"
        dir="ltr"
        aria-hidden="true"
      >
        {en}
      </span>
    </span>
  )
}
