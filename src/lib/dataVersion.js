// Compute a short, stable content fingerprint for a fetched JSON text.
// Used to:
//   1. Cache-bust localStorage-bound entries when the source corpus
//      changes (block/word indices may shift).
//   2. Tag every word-bank entry so we can warn the user about stale
//      "Jump to source" links after a corpus update.
//
// We use SHA-256 and keep the first 12 hex chars (~48 bits) — collision
// risk is irrelevant at this scale and the short string keeps stored
// entries compact.
export async function computeDataVersion(text) {
  if (!text || typeof crypto === 'undefined' || !crypto.subtle) {
    return 'unknown'
  }
  try {
    const buf = new TextEncoder().encode(text)
    const hash = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(hash))
      .slice(0, 6)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return 'unknown'
  }
}
