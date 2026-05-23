import React from 'react'
import { stripHarakat } from '../lib/stripHarakat.js'

export default function ArabicWord({ ar, en, showWbw, showIraab }) {
  const arabic = showIraab ? ar : stripHarakat(ar)
  if (showWbw) {
    return (
      <span className="word inline-flex flex-col items-center mx-1.5 mb-3 align-top">
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
    <span className="word ar inline-block mx-1.5 text-[1.65rem] md:text-[1.9rem] text-slate-800 dark:text-slate-100">
      {arabic}
    </span>
  )
}
