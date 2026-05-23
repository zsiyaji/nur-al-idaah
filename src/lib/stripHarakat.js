// Strip Arabic diacritics (harakat / tashkeel) and quranic marks.
// Ranges:
//   U+064B..U+065F  fathatan, dammatan, kasratan, fatha, damma, kasra, shadda, sukun, ...
//   U+0670          superscript alef
//   U+06D6..U+06ED  small high quranic marks
// Also normalize the alef wasla (U+0671) to plain alef (U+0627),
// and remove the standalone tatweel (U+0640).
const HARAKAT_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

export function stripHarakat(input) {
  if (!input) return input
  return input.replace(HARAKAT_RE, '').replace(/\u0671/g, '\u0627')
}

export default stripHarakat
