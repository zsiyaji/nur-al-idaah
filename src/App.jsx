import React, { useEffect, useMemo, useState } from 'react'
import Toolbar from './components/Toolbar.jsx'
import Block from './components/Block.jsx'
import useSettings from './lib/useSettings.js'
import { buildSections } from './lib/sections.js'

export default function App() {
  const { settings, toggle, reset } = useSettings()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}extracted.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  const { flatBlocks, sections, headingMetaByIndex } = useMemo(() => {
    if (!data) return { flatBlocks: [], sections: [], headingMetaByIndex: new Map() }
    const out = []
    let blockCounter = 0
    for (const page of data.pages) {
      out.push({ kind: 'page', page: page.page })
      for (const b of page.blocks) {
        out.push({ kind: 'block', block: b, blockIndex: blockCounter })
        blockCounter += 1
      }
    }
    const secs = buildSections(data.pages)
    const map = new Map()
    for (const s of secs) map.set(s.blockIndex, s)
    return { flatBlocks: out, sections: secs, headingMetaByIndex: map }
  }, [data])

  return (
    <div className="min-h-screen bg-white dark:bg-ink-900 text-slate-900 dark:text-slate-100">
      <Toolbar
        settings={settings}
        toggle={toggle}
        reset={reset}
        sections={sections}
      />

      <main className="max-w-prose mx-auto px-4 md:px-6 py-8">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 p-4">
            Failed to load text: {error}
          </div>
        )}

        {!data && !error && (
          <div className="text-slate-500 dark:text-slate-400 py-20 text-center">
            Loading…
          </div>
        )}

        {data && (
          <>
            <header className="mb-10 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                A reader for
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">
                Nūr al-Īḍāḥ
              </h1>
              <p className="mt-1 text-base md:text-lg text-slate-600 dark:text-slate-400">
                Kitāb al-Ṭahārah · The Book of Purification
              </p>
            </header>

            <div>
              {flatBlocks.map((item, idx) => {
                if (item.kind === 'page') {
                  return (
                    <div
                      key={`p-${item.page}-${idx}`}
                      className="my-8 flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600"
                    >
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                      <span>Page {item.page}</span>
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  )
                }
                return (
                  <Block
                    key={`b-${idx}`}
                    block={item.block}
                    settings={settings}
                    index={idx}
                    headingMeta={headingMetaByIndex.get(item.blockIndex)}
                  />
                )
              })}
            </div>

            <footer className="mt-20 mb-8 text-center text-xs text-slate-400 dark:text-slate-600">
              Source: <code className="text-slate-500 dark:text-slate-500">extracted.json</code>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}
