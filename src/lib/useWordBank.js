import { useCallback, useEffect, useMemo, useState } from 'react'
import { stripHarakat } from './stripHarakat.js'

const KEY = 'nai.wordbank.v1'

// Shape of a stored entry:
// {
//   id: '<blockIndex>:<wordIndex>',  // unique location key
//   ar: 'ٱلْحَمْدُ',
//   en: 'Praise',
//   blockIndex: 12,
//   wordIndex: 0,
//   sectionId: 'sec-12',        // closest preceding heading id, or null
//   sectionAr: 'فَصْلٌ ١',       // display Arabic of that section
//   sectionEn: 'Section 1',     // English (if any)
//   sectionKind: 'fasl-bare',   // 'kitab' | 'bab' | 'fasl-named' | 'fasl-bare' | null
//   addedAt: 1700000000000,
// }

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function makeId(blockIndex, wordIndex) {
  return `${blockIndex}:${wordIndex}`
}

export function useWordBank() {
  const [entries, setEntries] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries))
    } catch {}
  }, [entries])

  const hasWord = useCallback(
    (blockIndex, wordIndex) => {
      const id = makeId(blockIndex, wordIndex)
      return entries.some((e) => e.id === id)
    },
    [entries],
  )

  const addWord = useCallback((entry) => {
    setEntries((prev) => {
      const id = makeId(entry.blockIndex, entry.wordIndex)
      if (prev.some((e) => e.id === id)) return prev
      return [
        ...prev,
        {
          id,
          ar: entry.ar,
          en: entry.en,
          blockIndex: entry.blockIndex,
          wordIndex: entry.wordIndex,
          sectionId: entry.section?.id || null,
          sectionAr: entry.section?.displayAr || '',
          sectionEn: entry.section?.en || '',
          sectionKind: entry.section?.kind || null,
          sectionBlockIndex:
            entry.section?.blockIndex ?? null,
          addedAt: Date.now(),
        },
      ]
    })
  }, [])

  const removeWord = useCallback((blockIndex, wordIndex) => {
    const id = makeId(blockIndex, wordIndex)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const removeById = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const clearAll = useCallback(() => setEntries([]), [])

  // Group entries by section (fasl). Sections appear in document order
  // (we sort by sectionBlockIndex), and entries within a section are
  // sub-grouped by stripped-harakat Arabic so the same word's multiple
  // translations / source links collapse into one card.
  const groupedBySection = useMemo(() => {
    const groups = new Map() // sectionKey -> { section, words: Map<arBase, {ar, items: []}> }
    for (const e of entries) {
      const sectionKey = e.sectionId || '__none__'
      if (!groups.has(sectionKey)) {
        groups.set(sectionKey, {
          sectionId: e.sectionId,
          sectionAr: e.sectionAr,
          sectionEn: e.sectionEn,
          sectionKind: e.sectionKind,
          sectionBlockIndex: e.sectionBlockIndex,
          words: new Map(),
        })
      }
      const group = groups.get(sectionKey)
      const arBase = stripHarakat(e.ar || '').trim()
      if (!group.words.has(arBase)) {
        group.words.set(arBase, {
          arBase,
          ar: e.ar, // keep the first observed (with harakat) for display
          items: [],
        })
      }
      group.words.get(arBase).items.push(e)
    }
    const list = Array.from(groups.values()).map((g) => ({
      ...g,
      words: Array.from(g.words.values()).map((w) => ({
        ...w,
        items: w.items.slice().sort((a, b) => a.addedAt - b.addedAt),
      })),
    }))
    // Sort sections by their position in the document.
    list.sort((a, b) => {
      const ax = a.sectionBlockIndex ?? -1
      const bx = b.sectionBlockIndex ?? -1
      return ax - bx
    })
    return list
  }, [entries])

  // CSV rows: one row per unique (Arabic, translation, section) triple.
  const csvRows = useMemo(() => {
    const seen = new Set()
    const rows = []
    // Iterate in document order (section, then position within section).
    const ordered = entries
      .slice()
      .sort((a, b) => {
        const sa = a.sectionBlockIndex ?? -1
        const sb = b.sectionBlockIndex ?? -1
        if (sa !== sb) return sa - sb
        if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex
        return a.wordIndex - b.wordIndex
      })
    for (const e of ordered) {
      const arBase = stripHarakat(e.ar || '').trim()
      const fasl = e.sectionAr || ''
      const key = `${arBase}__${e.en}__${fasl}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        ar: e.ar,
        en: e.en,
        fasl,
        faslEn: e.sectionEn,
      })
    }
    return rows
  }, [entries])

  return {
    entries,
    hasWord,
    addWord,
    removeWord,
    removeById,
    clearAll,
    groupedBySection,
    csvRows,
    count: entries.length,
  }
}

export default useWordBank
