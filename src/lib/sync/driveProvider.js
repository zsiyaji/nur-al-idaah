// Google Drive AppData sync provider.
//
// Stores a single canonical JSON blob ("wordbank.v2.json") inside the
// user's Drive *appDataFolder* — a hidden folder scoped to this OAuth
// client only. Other apps (and even the user's own Drive UI) can't see
// it. We never request `drive` (full-Drive access).
//
// Concurrency story:
//   - Each save sends `If-Match: <etag>` so a stale client gets a 412
//     and is forced to re-fetch + re-merge + retry. This handles the
//     "phone and desktop save within the same minute" case.
//   - We poll for remote changes on a slow interval (default 30s) so a
//     change made on another device shows up without a page reload.
//
// Token story: the caller (the auth hook) is responsible for fetching
// access tokens. The provider just calls `getAccessToken()` whenever
// it needs one; the implementation can refresh as needed.

import {
  emptyEnvelope,
  normalizeEnvelope,
  canonicalizeEnvelope,
} from './merge.js'

// SECURITY: `FILE_NAME` is interpolated unescaped into the Drive
// search `q` parameter below. Keep it a hardcoded literal with no
// quotes / special characters so this can't become an injection
// surface if the constant is ever made dynamic.
const FILE_NAME = 'wordbank.v2.json'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const POLL_MS = 30_000

if (/['"\\]/.test(FILE_NAME)) {
  // Loud failure if someone changes FILE_NAME to something unsafe.
  throw new Error('Drive sync: FILE_NAME must not contain quotes')
}

async function authedFetch(getAccessToken, url, init = {}) {
  const token = await getAccessToken()
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}

async function findAppDataFile(getAccessToken) {
  const url = new URL(DRIVE_FILES)
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name = '${FILE_NAME}' and trashed = false`)
  url.searchParams.set('fields', 'files(id,name,modifiedTime,version)')
  url.searchParams.set('pageSize', '5')
  const r = await authedFetch(getAccessToken, url.toString())
  if (!r.ok) throw new Error(`drive_list_${r.status}`)
  const json = await r.json()
  const files = json.files || []
  if (files.length === 0) return null
  // If somehow more than one exists (e.g., concurrent first-write race),
  // pick the most recently modified and best-effort delete the others.
  files.sort((a, b) =>
    (b.modifiedTime || '').localeCompare(a.modifiedTime || ''),
  )
  for (let i = 1; i < files.length; i++) {
    try {
      await authedFetch(
        getAccessToken,
        `${DRIVE_FILES}/${files[i].id}`,
        { method: 'DELETE' },
      )
    } catch {}
  }
  return files[0]
}

async function readFileContent(getAccessToken, fileId) {
  const r = await authedFetch(
    getAccessToken,
    `${DRIVE_FILES}/${fileId}?alt=media`,
  )
  if (!r.ok) throw new Error(`drive_read_${r.status}`)
  // Capture etag for optimistic-concurrency on next write.
  const etag = r.headers.get('ETag') || null
  const text = await r.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {}
  return { envelope: normalizeEnvelope(parsed), etag }
}

async function createAppDataFile(getAccessToken, envelope) {
  const metadata = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  }
  const boundary = '-------nai-' + Math.random().toString(36).slice(2)
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(canonicalizeEnvelope(envelope)) +
    `\r\n--${boundary}--`

  const r = await authedFetch(
    getAccessToken,
    `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime,version`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )
  if (!r.ok) throw new Error(`drive_create_${r.status}`)
  const json = await r.json()
  return json
}

async function updateAppDataFile(getAccessToken, fileId, envelope, etag) {
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
  }
  if (etag) headers['If-Match'] = etag
  const r = await authedFetch(
    getAccessToken,
    `${DRIVE_UPLOAD}/${fileId}?uploadType=media&fields=id,modifiedTime,version`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(canonicalizeEnvelope(envelope)),
    },
  )
  if (r.status === 412) {
    const err = new Error('etag_mismatch')
    err.code = 'etag_mismatch'
    throw err
  }
  if (!r.ok) throw new Error(`drive_update_${r.status}`)
  return r.json()
}

// Public factory. `getAccessToken` is async and must always return a
// currently-valid token (handle refresh internally).
export function createDriveProvider({ getAccessToken, onError } = {}) {
  let cachedFileId = null
  let cachedEtag = null
  let pollTimer = null
  let lastModifiedTime = null

  async function ensureFile(envelope) {
    if (cachedFileId) return cachedFileId
    const existing = await findAppDataFile(getAccessToken)
    if (existing) {
      cachedFileId = existing.id
      lastModifiedTime = existing.modifiedTime || null
      return cachedFileId
    }
    const created = await createAppDataFile(getAccessToken, envelope || emptyEnvelope())
    cachedFileId = created.id
    lastModifiedTime = created.modifiedTime || null
    return cachedFileId
  }

  return {
    kind: 'drive',

    async load() {
      try {
        const file = await findAppDataFile(getAccessToken)
        if (!file) {
          cachedFileId = null
          cachedEtag = null
          lastModifiedTime = null
          return emptyEnvelope()
        }
        cachedFileId = file.id
        lastModifiedTime = file.modifiedTime || null
        const { envelope, etag } = await readFileContent(getAccessToken, file.id)
        cachedEtag = etag
        return envelope
      } catch (err) {
        if (onError) onError(err)
        throw err
      }
    },

    async save(envelope) {
      try {
        const id = await ensureFile(envelope)
        if (!cachedEtag) {
          // First save in this session — fetch current etag to avoid
          // clobbering a write made elsewhere between load and save.
          try {
            const fresh = await readFileContent(getAccessToken, id)
            cachedEtag = fresh.etag
          } catch {}
        }
        const updated = await updateAppDataFile(
          getAccessToken,
          id,
          envelope,
          cachedEtag,
        )
        lastModifiedTime = updated.modifiedTime || lastModifiedTime
        // We didn't get the new etag in the JSON response; null it so
        // the next write fetches a fresh one. (Cheap; happens at most
        // once per write burst because of debouncing upstream.)
        cachedEtag = null
      } catch (err) {
        if (onError) onError(err)
        throw err
      }
    },

    subscribe(callback) {
      const tick = async () => {
        try {
          const file = await findAppDataFile(getAccessToken)
          if (!file) return
          if (
            lastModifiedTime &&
            file.modifiedTime &&
            file.modifiedTime !== lastModifiedTime
          ) {
            const { envelope, etag } = await readFileContent(
              getAccessToken,
              file.id,
            )
            cachedFileId = file.id
            cachedEtag = etag
            lastModifiedTime = file.modifiedTime
            callback(envelope)
          } else if (!lastModifiedTime && file.modifiedTime) {
            lastModifiedTime = file.modifiedTime
          }
        } catch (err) {
          // Polling errors are expected (token expiry, offline). Don't
          // spam the user; just keep trying.
        }
      }
      pollTimer = setInterval(tick, POLL_MS)
      // First poll happens after the interval — there's no need to
      // race with the initial load() call.
      return () => {
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = null
      }
    },
  }
}
