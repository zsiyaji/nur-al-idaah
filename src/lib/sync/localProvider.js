// localStorage-backed sync provider. This is the default (anonymous)
// storage for the word bank: data lives in the user's browser only.
//
// Responsibilities:
//   - Persist a normalized envelope under `nai.wordbank.v2`.
//   - One-shot migration from the legacy `nai.wordbank.v1` array shape.
//   - Cross-tab change notification via the `storage` event.
//   - Surface write failures (e.g., quota exceeded) to a callback so
//     the UI can show a toast instead of silently dropping data.
import { stripHarakat } from '../stripHarakat.js'
import {
  emptyEnvelope,
  normalizeEnvelope,
  canonicalizeEnvelope,
} from './merge.js'

const KEY = 'nai.wordbank.v2'
const LEGACY_KEY = 'nai.wordbank.v1'

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Convert the legacy v1 format (flat array of entries) into a v2
// envelope. Output goes through `normalizeEnvelope` so the same
// allow-list / coercion / prototype-pollution guards apply to legacy
// data as to remote data.
function migrateLegacy() {
  let legacy
  try {
    legacy = localStorage.getItem(LEGACY_KEY)
  } catch {
    return null
  }
  if (!legacy) return null
  const parsed = safeParse(legacy)
  if (!Array.isArray(parsed)) return null

  // Retro-fit `arBase` if missing so the migrated bank can self-heal
  // display when the source corpus changes; the rest of the entry
  // shape is enforced by `normalizeEnvelope`.
  const enriched = parsed
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      ...e,
      arBase: e.arBase || stripHarakat(e.ar || '').trim(),
      dataVersion: e.dataVersion || 'unknown',
    }))

  return normalizeEnvelope({
    schema: 2,
    updatedAt: Date.now(),
    entries: enriched,
    tombstones: {},
  })
}

function readEnvelope() {
  let raw
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return emptyEnvelope()
  }
  if (!raw) {
    const migrated = migrateLegacy()
    if (migrated) return migrated
    return emptyEnvelope()
  }
  const parsed = safeParse(raw)
  return normalizeEnvelope(parsed)
}

function writeEnvelope(env, onError) {
  try {
    const canonical = canonicalizeEnvelope(env)
    localStorage.setItem(KEY, JSON.stringify(canonical))
    return true
  } catch (err) {
    if (onError) onError(err)
    return false
  }
}

// Public API. Each call returns a fresh provider instance so callers
// (typically a single React hook) can safely close over `onError`.
export function createLocalProvider({ onError } = {}) {
  let migratedOnce = false

  return {
    kind: 'local',

    load() {
      const env = readEnvelope()
      // Persist the migrated shape so subsequent loads are O(1) and
      // future code paths can assume the v2 envelope.
      if (!migratedOnce) {
        migratedOnce = true
        const raw = (() => {
          try {
            return localStorage.getItem(KEY)
          } catch {
            return null
          }
        })()
        if (!raw && env.entries.length > 0) {
          writeEnvelope(env, onError)
          // Best-effort cleanup of legacy key once v2 is durable.
          try {
            localStorage.removeItem(LEGACY_KEY)
          } catch {}
        }
      }
      return Promise.resolve(env)
    },

    save(env) {
      const ok = writeEnvelope(env, onError)
      return ok ? Promise.resolve() : Promise.reject(new Error('write_failed'))
    },

    // Subscribe to writes from other tabs of the same origin.
    // The `storage` event fires only on tabs *other* than the one
    // that wrote — exactly the cross-tab semantics we want.
    subscribe(callback) {
      const onStorage = (e) => {
        if (e.key !== KEY) return
        const next = e.newValue ? safeParse(e.newValue) : null
        callback(normalizeEnvelope(next))
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}
