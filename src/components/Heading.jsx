import React from 'react'
import { stripHarakat } from '../lib/stripHarakat.js'

export default function Heading({ block, settings, id, displayAr }) {
  const source = displayAr || block.ar
  const ar = settings.iraab ? source : stripHarakat(source)
  return (
    <section id={id} className="my-10 text-center scroll-mt-24">
      {settings.arabic && (
        <h2 className="ar ar-lg font-bold text-emerald-800 dark:text-emerald-300">
          {ar}
        </h2>
      )}
      {settings.translation && block.en && (
        <p className="mt-2 text-sm md:text-base uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {block.en}
        </p>
      )}
    </section>
  )
}
