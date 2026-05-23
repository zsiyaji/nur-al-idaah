import { stripHarakat } from './stripHarakat.js'

const FASL_BARE = 'فصل' // strip-harakat form of فَصْلٌ
const CHAPTER_PREFIXES = ['كتاب', 'باب'] // strip-harakat starts

// Convert a Latin integer to Arabic-Indic digits (e.g. 12 -> "١٢").
export function toArabicNumeral(n) {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return String(n)
    .split('')
    .map((c) => (c >= '0' && c <= '9' ? map[Number(c)] : c))
    .join('')
}

function isBismillah(stripped) {
  return stripped.startsWith('بسم الله')
}

function isChapter(stripped) {
  return CHAPTER_PREFIXES.some((p) => stripped.startsWith(p))
}

function isBareFasl(stripped) {
  // The bare fasl heading is exactly the word "فَصْلٌ" (perhaps with trailing punctuation).
  const cleaned = stripped.replace(/[\s.,،؛:]+$/u, '')
  return cleaned === FASL_BARE
}

// Build a list of navigable sections from the flattened block list.
// Returns an array of { id, displayAr, en, kind, blockIndex } where kind is
// one of: 'kitab' | 'bab' | 'fasl-named' | 'fasl-bare'. Bismillah is skipped.
export function buildSections(pages) {
  const sections = []
  let fasl = 0
  let blockCounter = 0
  for (const page of pages) {
    for (const b of page.blocks) {
      if (b.type === 'heading') {
        const stripped = stripHarakat(b.ar || '').trim()
        if (!isBismillah(stripped)) {
          if (isChapter(stripped)) {
            fasl = 0 // reset fasl counter at each chapter / book
            sections.push({
              id: `sec-${blockCounter}`,
              displayAr: b.ar,
              en: b.en || '',
              kind: stripped.startsWith('كتاب') ? 'kitab' : 'bab',
              blockIndex: blockCounter,
            })
          } else if (isBareFasl(stripped)) {
            fasl += 1
            const displayAr = `فَصْلٌ ${toArabicNumeral(fasl)}`
            sections.push({
              id: `sec-${blockCounter}`,
              displayAr,
              en: b.en || '',
              kind: 'fasl-bare',
              blockIndex: blockCounter,
            })
          } else {
            // Named fasl or other heading — keep its own Arabic
            sections.push({
              id: `sec-${blockCounter}`,
              displayAr: b.ar,
              en: b.en || '',
              kind: 'fasl-named',
              blockIndex: blockCounter,
            })
          }
        }
      }
      blockCounter += 1
    }
  }
  return sections
}
