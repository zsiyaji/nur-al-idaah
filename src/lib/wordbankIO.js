// Export helpers for the word bank. JSON export is intentionally
// one-way: there is no in-app importer, because user-supplied JSON
// would be a viable injection vector (prototype pollution via
// tombstones map keys, selector injection via spoofed indices) for a
// public site. Users who want to migrate their bank between browsers
// should sign in with Google to use Drive sync instead.
import { canonicalizeEnvelope } from './sync/merge.js'

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Read-only JSON snapshot for users who want a manual backup of their
// bank. Re-importing this file is intentionally not supported.
export function exportEnvelopeAsJSON(envelope) {
  const canonical = canonicalizeEnvelope(envelope)
  const payload = {
    app: 'nur-al-idah-reader',
    type: 'wordbank-export',
    exportedAt: new Date().toISOString(),
    envelope: canonical,
  }
  const text = JSON.stringify(payload, null, 2)
  return new Blob([text], { type: 'application/json;charset=utf-8' })
}
