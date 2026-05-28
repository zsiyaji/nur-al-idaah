// Merge two word-bank envelopes into one. Designed so it is safe to
// run on any pair of (local, remote) snapshots and produce a result
// that's idempotent and convergent across devices.
//
// Strategy:
//   - Entries are keyed by `id` ("blockIndex:wordIndex").
//   - For each `id` present on either side, keep the one with the
//     greater `addedAt`. (Equal timestamps: prefer the side passed
//     second, which by convention is the more authoritative one.)
//   - Tombstones (`{ [id]: deletedAt }`) record removals. If a
//     tombstone for an id has `deletedAt > entry.addedAt`, the
//     deletion wins and the entry is dropped from the merged result.
//   - Tombstones themselves merge by max `deletedAt` per id, and
//     are preserved in the output so subsequent merges still suppress
//     the entry. Tombstones older than `TOMBSTONE_TTL_MS` are GC'd to
//     prevent unbounded growth.
//
// Hardening:
//   - Tombstones use a null-prototype object internally, and reserved
//     keys (`__proto__`, `constructor`, `prototype`) are dropped at
//     normalize time. This blocks prototype pollution from any source
//     of envelope data — the user's own Drive file, a corrupted
//     localStorage blob, or (historically) a JSON import.
//   - Entry shape is enforced via an explicit allow-list. Unknown
//     fields are dropped and `blockIndex`/`wordIndex` are coerced to
//     finite non-negative integers; entries that fail validation are
//     silently filtered out so they can't carry rogue payloads (e.g.
//     selector-injection strings) into the rest of the app.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

const ENTRY_FIELDS = [
  'id',
  'ar',
  'arBase',
  'en',
  'sectionId',
  'sectionAr',
  'sectionEn',
  'sectionKind',
  'dataVersion',
]

function toIntOrNull(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (!Number.isInteger(n)) return null
  if (n < 0) return null
  return n
}

function toMillisOrNull(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function sanitizeEntry(input) {
  if (!input || typeof input !== 'object') return null
  const blockIndex = toIntOrNull(input.blockIndex)
  const wordIndex = toIntOrNull(input.wordIndex)
  if (blockIndex === null || wordIndex === null) return null

  const expectedId = `${blockIndex}:${wordIndex}`
  // Trust the structural id over any user-supplied `id` field.
  const out = {
    id: expectedId,
    blockIndex,
    wordIndex,
    sectionBlockIndex: toIntOrNull(input.sectionBlockIndex),
    addedAt: toMillisOrNull(input.addedAt) ?? Date.now(),
  }
  for (const k of ENTRY_FIELDS) {
    if (k === 'id') continue
    const v = input[k]
    out[k] = typeof v === 'string' ? v : ''
  }
  return out
}

function sanitizeTombstones(input) {
  // Use a null-prototype object so accidental `__proto__` writes elsewhere
  // can't traverse to Object.prototype.
  const out = Object.create(null)
  if (!input || typeof input !== 'object') return out
  for (const k of Object.keys(input)) {
    if (FORBIDDEN_KEYS.has(k)) continue
    const v = toMillisOrNull(input[k])
    if (v !== null) out[k] = v
  }
  return out
}

function gcTombstones(tombstones) {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  const out = Object.create(null)
  for (const k of Object.keys(tombstones)) {
    const v = tombstones[k]
    if (v >= cutoff) out[k] = v
  }
  return out
}

export function emptyEnvelope() {
  return {
    schema: 2,
    updatedAt: 0,
    entries: [],
    tombstones: Object.create(null),
  }
}

export function normalizeEnvelope(input) {
  if (!input || typeof input !== 'object') return emptyEnvelope()
  const rawEntries = Array.isArray(input.entries) ? input.entries : []
  const entries = []
  for (const e of rawEntries) {
    const clean = sanitizeEntry(e)
    if (clean) entries.push(clean)
  }
  const tombstones = sanitizeTombstones(input.tombstones)
  return {
    schema: 2,
    updatedAt: toMillisOrNull(input.updatedAt) ?? 0,
    entries,
    tombstones,
  }
}

export function mergeEnvelopes(a, b) {
  const A = normalizeEnvelope(a)
  const B = normalizeEnvelope(b)

  // Merge tombstones (keep latest deletedAt per id), then GC.
  const tombstones = Object.create(null)
  for (const id of Object.keys(A.tombstones)) tombstones[id] = A.tombstones[id]
  for (const id of Object.keys(B.tombstones)) {
    const ax = tombstones[id] || 0
    const bx = B.tombstones[id] || 0
    if (bx > ax) tombstones[id] = bx
  }
  const liveTombstones = gcTombstones(tombstones)

  // Merge entries by id, keeping the newer one. Side B wins ties so
  // that callers can express "prefer remote" by passing remote second.
  const map = new Map()
  for (const e of A.entries) map.set(e.id, e)
  for (const e of B.entries) {
    const ex = map.get(e.id)
    if (!ex) {
      map.set(e.id, e)
    } else if ((e.addedAt ?? 0) >= (ex.addedAt ?? 0)) {
      map.set(e.id, e)
    }
  }

  // Drop any entry whose tombstone post-dates its addedAt.
  const survivors = []
  for (const e of map.values()) {
    const t = liveTombstones[e.id]
    if (t && t > (e.addedAt ?? 0)) continue
    survivors.push(e)
  }

  return {
    schema: 2,
    updatedAt: Math.max(A.updatedAt, B.updatedAt, Date.now()),
    entries: survivors,
    tombstones: liveTombstones,
  }
}

// Stable ordering for serialization so two devices producing
// equivalent state generate byte-identical blobs (helps Drive ETag
// reuse and human diffing). The persistence-friendly form keeps the
// `updatedAt` bookkeeping field.
export function canonicalizeEnvelope(env) {
  const norm = normalizeEnvelope(env)
  const entries = norm.entries
    .slice()
    .sort((a, b) => {
      if (a.id < b.id) return -1
      if (a.id > b.id) return 1
      return 0
    })
  const tombKeys = Object.keys(norm.tombstones).sort()
  // Output uses a plain object so JSON.stringify preserves the keys.
  // Reserved keys were already filtered in normalize; this is safe.
  const tombstones = {}
  for (const k of tombKeys) tombstones[k] = norm.tombstones[k]
  return {
    schema: 2,
    updatedAt: norm.updatedAt,
    entries,
    tombstones,
  }
}

// Like `canonicalizeEnvelope` but omits `updatedAt`. Use this when
// comparing two envelopes for equivalence — every merge bumps
// `updatedAt`, so including it would defeat dedup short-circuits in
// the persistence layer.
export function envelopeContentSerial(env) {
  const c = canonicalizeEnvelope(env)
  return JSON.stringify({
    schema: c.schema,
    entries: c.entries,
    tombstones: c.tombstones,
  })
}
