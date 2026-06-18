import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Toolbar from './components/Toolbar.jsx'
import Block from './components/Block.jsx'
import WordPopover from './components/WordPopover.jsx'
import WordBankDrawer from './components/WordBankDrawer.jsx'
import Toast from './components/Toast.jsx'
import useSettings from './lib/useSettings.js'
import useWordBank from './lib/useWordBank.js'
import { buildSections } from './lib/sections.js'
import { combineCorpus } from './lib/corpus.js'
import { captureBlockAnchor, restoreBlockAnchor } from './lib/scrollAnchor.js'
import { computeDataVersion } from './lib/dataVersion.js'
import {
  createDriveProvider,
  isGoogleConfigured,
  useGoogleAuth,
} from './lib/sync/index.js'
import { notify } from './lib/notify.js'

export default function App() {
  const { settings, toggle, reset, update } = useSettings()
  const [data, setData] = useState(null)
  const [dataVersion, setDataVersion] = useState(null)
  const [error, setError] = useState(null)
  const [selection, setSelection] = useState(null) // { ar, en, blockIndex, wordIndex, section }
  const [bankOpen, setBankOpen] = useState(false)

  // --- google auth (opt-in, no-op if VITE_GOOGLE_CLIENT_ID is unset) -
  const auth = useGoogleAuth({
    onError: (err) => {
      const code = err?.message || 'auth_error'
      if (code === 'popup_closed' || code === 'access_denied') return
      notify({ kind: 'warn', message: 'Google sign-in failed.' })
    },
  })

  // Build a Drive provider only while signed-in. Recreated on each
  // sign-in cycle so token closure is fresh.
  const drive = useMemo(() => {
    if (!auth.isSignedIn) return null
    return {
      provider: createDriveProvider({
        getAccessToken: auth.getAccessToken,
        onError: (err) => {
          const code = err?.code || err?.message
          if (code === 'etag_mismatch') return // handled upstream
          // Suppress polling errors so we don't toast on every offline tick.
        },
      }),
    }
  }, [auth.isSignedIn, auth.getAccessToken])

  const bank = useWordBank({ dataVersion, drive })

  // --- scroll-anchor preservation across settings toggles -------------
  const pendingAnchorRef = useRef(null)
  const anchoredToggle = useCallback(
    (key) => {
      if (key !== 'dark') {
        pendingAnchorRef.current = captureBlockAnchor()
      }
      toggle(key)
    },
    [toggle],
  )
  const anchoredReset = useCallback(() => {
    pendingAnchorRef.current = captureBlockAnchor()
    reset()
  }, [reset])

  useLayoutEffect(() => {
    if (!pendingAnchorRef.current) return
    const anchor = pendingAnchorRef.current
    pendingAnchorRef.current = null
    restoreBlockAnchor(anchor)
  }, [settings.arabic, settings.wbw, settings.translation, settings.iraab])

  // --- data loading ---------------------------------------------------
  useEffect(() => {
    let cancelled = false
    // The reader spans two books: Kitāb al-Ṭahārah (extracted.json) and
    // Kitāb al-Ṣalāh (kitaab-al-salah.json). They are fetched together and
    // stitched into one continuous corpus by `combineCorpus`.
    //
    // `cache: 'no-store'` prevents stale in-flight reads after a corpus
    // refresh; combined with the SHA-based dataVersion below, the bank
    // can flag entries that point at a previous extraction.
    const fetchText = (file) =>
      fetch(`${import.meta.env.BASE_URL}${file}`, { cache: 'no-store' }).then(
        (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} (${file})`)
          return r.text()
        },
      )

    Promise.all([
      fetchText('extracted.json'),
      fetchText('kitaab-al-salah.json'),
    ])
      .then(async ([taharahText, salahText]) => {
        // Version tracks both sources so bank entries are re-flagged if
        // either book changes.
        const version = await computeDataVersion(`${taharahText}\u0000${salahText}`)
        const combined = combineCorpus(
          JSON.parse(taharahText),
          JSON.parse(salahText),
        )
        return { combined, version }
      })
      .then(({ combined, version }) => {
        if (cancelled) return
        setData(combined)
        setDataVersion(version)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Flatten blocks and build sections + per-block section context.
  const {
    flatBlocks,
    sections,
    headingMetaByIndex,
    sectionByBlockIndex,
  } = useMemo(() => {
    if (!data) {
      return {
        flatBlocks: [],
        sections: [],
        headingMetaByIndex: new Map(),
        sectionByBlockIndex: new Map(),
      }
    }
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
    const headingMap = new Map()
    for (const s of secs) headingMap.set(s.blockIndex, s)

    const sectionMap = new Map()
    let current = null
    for (let i = 0; i < blockCounter; i++) {
      if (headingMap.has(i)) current = headingMap.get(i)
      sectionMap.set(i, current)
    }
    return {
      flatBlocks: out,
      sections: secs,
      headingMetaByIndex: headingMap,
      sectionByBlockIndex: sectionMap,
    }
  }, [data])

  // --- word selection / popover --------------------------------------
  const handleWordClick = useCallback((info) => {
    setSelection((prev) => {
      if (
        prev &&
        prev.blockIndex === info.blockIndex &&
        prev.wordIndex === info.wordIndex
      ) {
        return null
      }
      return info
    })
  }, [])

  const selectionInBank = selection
    ? bank.hasWord(selection.blockIndex, selection.wordIndex)
    : false

  const handlePopoverAdd = useCallback(() => {
    if (!selection) return
    bank.addWord(selection)
  }, [selection, bank])

  const handlePopoverRemove = useCallback(() => {
    if (!selection) return
    bank.removeWord(selection.blockIndex, selection.wordIndex)
  }, [selection, bank])

  // --- jump back to source from word bank ----------------------------
  const jumpToSource = useCallback(
    (entry) => {
      setBankOpen(false)
      if (!settings.arabic) update({ arabic: true })

      setTimeout(() => {
        // `entry.{blockIndex,wordIndex}` are coerced to integers by
        // `normalizeEnvelope`, but we still escape defensively so any
        // future code that bypasses normalize can't inject CSS
        // selectors here.
        const bi = CSS.escape(String(entry.blockIndex))
        const wi = CSS.escape(String(entry.wordIndex))
        const wordEl = document.querySelector(
          `[data-block-index="${bi}"][data-word-index="${wi}"]`,
        )
        const blockEl = document.querySelector(
          `[data-block-index="${bi}"]`,
        )
        const target = wordEl || blockEl
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        if (wordEl) {
          // If the corpus version changed, the cell at that location
          // may now hold a different word. Warn the user instead of
          // silently flashing the wrong target.
          if (
            entry.dataVersion &&
            dataVersion &&
            entry.dataVersion !== 'unknown' &&
            entry.dataVersion !== dataVersion
          ) {
            notify({
              kind: 'warn',
              message:
                'This entry was saved against a previous version of the text — its source location may have shifted.',
            })
          }
          wordEl.classList.remove('word-flash')
          // restart animation
          // eslint-disable-next-line no-unused-expressions
          void wordEl.offsetWidth
          wordEl.classList.add('word-flash')
        } else if (!blockEl) {
          notify({
            kind: 'warn',
            message: 'Could not locate the source for that entry.',
          })
        }
      }, 80)
    },
    [settings.arabic, update, dataVersion],
  )

  return (
    <div className="min-h-screen bg-white dark:bg-ink-900 text-slate-900 dark:text-slate-100">
      <Toolbar
        settings={settings}
        toggle={anchoredToggle}
        reset={anchoredReset}
        sections={sections}
        bankCount={bank.count}
        onOpenBank={() => setBankOpen(true)}
        auth={auth}
        googleConfigured={isGoogleConfigured()}
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
                Kitāb al-Ṭahārah &amp; Kitāb al-Ṣalāh · Purification &amp; Prayer
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
                    key={`b-${item.blockIndex}`}
                    block={item.block}
                    settings={settings}
                    blockIndex={item.blockIndex}
                    headingMeta={headingMetaByIndex.get(item.blockIndex)}
                    currentSection={sectionByBlockIndex.get(item.blockIndex)}
                    onWordClick={handleWordClick}
                    isWordInBank={bank.hasWord}
                  />
                )
              })}
            </div>

            <footer className="mt-20 mb-8 text-center text-xs text-slate-400 dark:text-slate-600 space-x-3">
              <span>
                Source: <code className="text-slate-500 dark:text-slate-500">extracted.json</code>
              </span>
              <span aria-hidden="true">·</span>
              <a
                href={`${import.meta.env.BASE_URL}privacy.html`}
                className="hover:text-emerald-700 dark:hover:text-emerald-400 underline-offset-2 hover:underline"
              >
                Privacy
              </a>
            </footer>
          </>
        )}
      </main>

      <WordPopover
        selection={selection}
        inBank={selectionInBank}
        onAdd={handlePopoverAdd}
        onRemove={handlePopoverRemove}
        onClose={() => setSelection(null)}
      />

      <WordBankDrawer
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        bank={bank}
        showIraab={settings.iraab}
        onJumpToSource={jumpToSource}
        auth={auth}
        googleConfigured={isGoogleConfigured()}
      />

      <Toast />
    </div>
  )
}
