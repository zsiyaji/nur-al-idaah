import React from 'react'
import ArabicWord from './ArabicWord.jsx'

export default function Sentence({ block, settings, index }) {
  const isList = block.type === 'list_item'
  const showAnything = settings.arabic || settings.translation
  if (!showAnything) return null

  return (
    <article
      className={[
        'group relative my-6 rounded-xl border border-transparent p-4 md:p-6',
        'hover:border-slate-200 dark:hover:border-slate-800 transition-colors',
      ].join(' ')}
    >
      {isList && block.number != null && (
        <div className="absolute -left-2 -top-2 md:-left-3 md:-top-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-semibold shadow">
          {block.number}
        </div>
      )}

      {settings.arabic && (
        <div
          className={[
            'ar text-right',
            settings.wbw
              ? 'flex flex-wrap justify-start gap-y-1'
              : 'leading-loose',
          ].join(' ')}
          dir="rtl"
        >
          {block.words.map((w, i) => (
            <ArabicWord
              key={i}
              ar={w.ar}
              en={w.en}
              showWbw={settings.wbw}
              showIraab={settings.iraab}
            />
          ))}
        </div>
      )}

      {settings.translation && block.translation && (
        <p
          className={[
            'text-slate-700 dark:text-slate-300 leading-relaxed',
            settings.arabic ? 'mt-4 pt-4 border-t border-slate-100 dark:border-slate-800' : '',
          ].join(' ')}
        >
          {block.translation}
        </p>
      )}
    </article>
  )
}
