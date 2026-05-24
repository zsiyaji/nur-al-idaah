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
import useSettings from './lib/useSettings.js'
import useWordBank from './lib/useWordBank.js'
import { buildSections } from './lib/sections.js'
import { captureBlockAnchor, restoreBlockAnchor } from './lib/scrollAnchor.js'

export default function App() {
  const { settings, toggle, reset, update } = useSettings()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selection, setSelection] = useState(null) // { ar, en, blockIndex, wordIndex, section }
  const [bankOpen, setBankOpen] = useState(false)
  const bank = useWordBank()

  // --- scroll-anchor preservation across settings toggles -------------
  //
  // Toggling word-by-word / full translation / arabic / iraab changes
  // the height of every block above the user, which would otherwise
  // jump them to a different fasl. We capture the topmost visible block
  // BEFORE the change, and restore its viewport offset in a layout
  // effect AFTER React commits the new DOM.
  const pendingAnchorRef = useRef(null)
  const anchoredToggle = useCallback(
    (key) => {
      // Only height-changing settings need scroll restoration. Skip for
      // 'dark' to avoid pointless work.
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
    fetch(`${import.meta.env.BASE_URL}extracted.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
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

    // For each block, find the most recent preceding section (so words
    // are tagged with the fasl they belong to). Chapter-level entries
    // (kitab/bab) count too — they bracket the early intro text.
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
  const handleWordClick = useCallback(
    (info, evt) => {
      // Toggle: clicking the same word that's already selected closes.
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
    },
    [],
  )

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
      // If Arabic display is off, the word isn't in the DOM. Turn it on
      // so the user can actually see what they jumped to.
      if (!settings.arabic) update({ arabic: true })

      // Defer to allow the drawer to start closing (and body-scroll lock
      // to release), and any settings change above to commit.
      setTimeout(() => {
        const selector = `[data-block-index="${entry.blockIndex}"][data-word-index="${entry.wordIndex}"]`
        const wordEl = document.querySelector(selector)
        const blockEl = document.querySelector(
          `[data-block-index="${entry.blockIndex}"]`,
        )
        const target = wordEl || blockEl
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        if (wordEl) {
          wordEl.classList.remove('word-flash')
          // restart animation
          // eslint-disable-next-line no-unused-expressions
          void wordEl.offsetWidth
          wordEl.classList.add('word-flash')
        }
      }, 80)
    },
    [settings.arabic, update],
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

            <footer className="mt-20 mb-8 text-center text-xs text-slate-400 dark:text-slate-600">
              Source: <code className="text-slate-500 dark:text-slate-500">extracted.json</code>
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
      />
    </div>
  )
}
