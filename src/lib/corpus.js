import { stripHarakat } from './stripHarakat.js'

// The bare faṣl heading is exactly the word "فَصْلٌ" once ḥarakāt are
// stripped. Headings that already carry a title (e.g. "فَصْلٌ فِي سُنَنِهَا")
// or the split second-line titles (e.g. "فِي كَيْفِيَّةِ تَرْكِيبِ ٱلصَّلَاةِ")
// are left untouched.
const BARE_FASL = 'فصل'

// Synthetic book heading injected at the head of the Ṣalāh corpus. The
// source extraction for Kitāb al-Ṣalāh begins mid-content (it has no
// "كتاب الصلاة" heading of its own), so we prepend one to mark the new
// book and let the section navigator treat it as a top-level kitāb.
const SALAH_BOOK_HEADING = {
  type: 'heading',
  ar: 'كِتَابُ ٱلصَّلَاةِ',
  en: 'The Book of Prayer',
}

// Proper faṣl titles for the otherwise-bare "فَصْلٌ" headings, in the exact
// order they appear across the combined corpus (Kitāb al-Ṭahārah first,
// then Kitāb al-Ṣalāh). Sourced from the canonical Nūr al-Īḍāḥ table of
// contents (elmpedia.com/contexts/139) and individually verified against
// the content that follows each heading in the extraction.
//
// Note: "split" headings — a bare "فَصْلٌ" immediately followed by a second
// heading holding the title — are merged separately (see mergeFaslHeadings)
// and therefore do NOT consume an entry from this list.
const BARE_FASL_NAMES = [
  // ── Kitāb al-Ṭahārah ──────────────────────────────────────────────
  { ar: 'فَصْلٌ فِي بَيَانِ أَحْكَامِ ٱلسُّؤْرِ', en: 'Section: On the rulings of leftover water (suʾr)' },
  { ar: 'فَصْلٌ فِي ٱلتَّحَرِّي فِي ٱلْأَوَانِي وَٱلثِّيَابِ', en: 'Section: On investigating vessels and garments' },
  { ar: 'فَصْلٌ فِي تَطْهِيرِ ٱلْآبَارِ', en: 'Section: On purifying wells' },
  { ar: 'فَصْلٌ فِي حُكْمِ كَشْفِ ٱلْعَوْرَةِ لِلِٱسْتِنْجَاءِ وَإِزَالَةِ ٱلنَّجَاسَةِ', en: 'Section: On uncovering the ʿawrah for istinjāʾ and removing impurity' },
  { ar: 'فَصْلٌ فِي تَمَامِ أَحْكَامِ ٱلْوُضُوءِ', en: 'Section: On the remaining rulings of wuḍūʾ' },
  { ar: 'فَصْلٌ فِي سُنَنِ ٱلْوُضُوءِ', en: 'Section: On the sunnahs of wuḍūʾ' },
  { ar: 'فَصْلٌ فِي آدَابِ ٱلْوُضُوءِ', en: 'Section: On the etiquette of wuḍūʾ' },
  { ar: 'فَصْلٌ فِي مَكْرُوهَاتِ ٱلْوُضُوءِ', en: 'Section: On the disliked acts of wuḍūʾ' },
  { ar: 'فَصْلٌ فِي أَقْسَامِ ٱلْوُضُوءِ', en: 'Section: On the categories of wuḍūʾ' },
  { ar: 'فَصْلٌ فِي نَوَاقِضِ ٱلْوُضُوءِ', en: 'Section: On the nullifiers of wuḍūʾ' },
  { ar: 'فَصْلٌ فِيمَا لَا يَنْقُضُ ٱلْوُضُوءَ', en: 'Section: On what does not nullify wuḍūʾ' },
  { ar: 'فَصْلٌ فِيمَا لَا يُوجِبُ ٱلِٱغْتِسَالَ', en: 'Section: On what does not necessitate ghusl' },
  { ar: 'فَصْلٌ فِي بَيَانِ فَرَائِضِ ٱلْغُسْلِ', en: 'Section: On the obligatory acts (farāʾiḍ) of ghusl' },
  { ar: 'فَصْلٌ فِي سُنَنِ ٱلْغُسْلِ', en: 'Section: On the sunnahs of ghusl' },
  { ar: 'فَصْلٌ فِي آدَابِ ٱلِٱغْتِسَالِ وَمَكْرُوهَاتِهِ', en: 'Section: On the etiquette and disliked acts of ghusl' },
  { ar: 'فَصْلٌ فِيمَا سُنَّ لَهُ ٱلِٱغْتِسَالُ', en: 'Section: On that for which ghusl is sunnah' },
  { ar: 'فَصْلٌ فِي ٱلْجَبِيرَةِ وَنَحْوِهَا', en: 'Section: On the splint (jabīrah) and the like' },
  { ar: 'فَصْلٌ فِي طَهَارَةِ جِلْدِ ٱلْمَيْتَةِ وَنَحْوِهَا', en: 'Section: On the purity of carrion skin and the like' },
  // ── Kitāb al-Ṣalāh ────────────────────────────────────────────────
  { ar: 'فَصْلٌ فِي مُتَعَلِّقَاتِ ٱلشُّرُوطِ وَفُرُوعِهَا', en: 'Section: On matters pertaining to the conditions and their derivatives' },
  { ar: 'فَصْلٌ فِي آدَابِ ٱلصَّلَاةِ', en: 'Section: On the etiquette of the prayer' },
  { ar: 'فَصْلٌ فِيمَا يُسْقِطُ حُضُورَ ٱلْجَمَاعَةِ', en: 'Section: On what excuses one from attending the congregation' },
  { ar: 'فَصْلٌ فِيمَا لَا يُفْسِدُ ٱلصَّلَاةَ', en: 'Section: On what does not invalidate the prayer' },
  { ar: 'فَصْلٌ فِي مَكْرُوهَاتِ ٱلصَّلَاةِ', en: 'Section: On the disliked acts of the prayer' },
  { ar: 'فَصْلٌ فِي سَجْدَةِ ٱلشُّكْرِ', en: 'Section: On the prostration of gratitude' },
  { ar: 'فَصْلٌ فِي صَلَاةِ ٱلْجَنَازَةِ', en: 'Section: On the funeral prayer (ṣalāt al-janāzah)' },
  { ar: 'فَصْلٌ فِي أَحْوَالِ ٱلصَّلَاةِ عَلَى ٱلْمَيِّتِ', en: 'Section: On the modes of praying over the deceased' },
]

function strippedHeadingText(ar) {
  return stripHarakat(ar || '')
    .replace(/[\s.,،؛:]+$/u, '')
    .trim()
}

function isBareFaslHeading(block) {
  return (
    block &&
    block.type === 'heading' &&
    strippedHeadingText(block.ar) === BARE_FASL
  )
}

// Merge a "split" faṣl heading — a bare "فَصْلٌ" immediately followed by one
// or more heading blocks that carry its title — into a single titled
// heading. This is purely structural and order-independent: the titles
// come straight from the source data, so re-extraction cannot misalign it.
function mergeFaslHeadings(blocks) {
  const out = []
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (isBareFaslHeading(block) && blocks[i + 1]?.type === 'heading') {
      const run = [block]
      let j = i + 1
      while (j < blocks.length && blocks[j].type === 'heading') {
        run.push(blocks[j])
        j += 1
      }
      const ar = run.map((h) => h.ar || '').filter(Boolean).join(' ')
      const rest = run
        .slice(1)
        .map((h) => h.en || '')
        .filter(Boolean)
        .join(' ')
      const en = rest ? `Section: ${rest}` : run[0].en || 'Section'
      out.push({ ...block, ar, en })
      i = j - 1
    } else {
      out.push(block)
    }
  }
  return out
}

// Assign canonical titles to the remaining bare "فَصْلٌ" headings, consuming
// BARE_FASL_NAMES in document order. Mutates the heading blocks in place.
// Any bare heading beyond the known list is left untouched (the section
// builder will fall back to numbering it).
function nameBareFasls(pages) {
  let idx = 0
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (isBareFaslHeading(block)) {
        const name = BARE_FASL_NAMES[idx]
        if (name) {
          block.ar = name.ar
          block.en = name.en
        }
        idx += 1
      }
    }
  }
}

// Combine the two source corpora (Kitāb al-Ṭahārah + Kitāb al-Ṣalāh) into a
// single continuous reader document:
//   1. Prepend a synthetic "كتاب الصلاة" heading to the Ṣalāh pages.
//   2. Concatenate the pages (Ṭahārah first).
//   3. Merge split faṣl headings so each section shows one title.
//   4. Name the bare faṣl headings from the canonical table of contents.
export function combineCorpus(taharah, salah) {
  const taharahPages = taharah?.pages || []
  const salahPages = (salah?.pages || []).map((page, index) =>
    index === 0
      ? { ...page, blocks: [SALAH_BOOK_HEADING, ...(page.blocks || [])] }
      : page,
  )

  const pages = [...taharahPages, ...salahPages].map((page) => ({
    ...page,
    blocks: mergeFaslHeadings(page.blocks || []),
  }))

  nameBareFasls(pages)

  return { ...(taharah || {}), pages }
}
