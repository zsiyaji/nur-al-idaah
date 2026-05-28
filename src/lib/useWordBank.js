// Word-bank state hook (envelope-shaped, provider-agnostic).
//
// The in-memory envelope is the source of truth for the UI. The local
// provider persists every mutation to `localStorage` synchronously. An
// optional Drive provider, supplied by the caller when the user is
// signed in, is debounced-pushed on every change and pulled on a slow
// poll for cross-device updates.
//
// On first sign-in the local and remote envelopes are merged (set-union
// by id with last-write-wins by addedAt; tombstones suppress deleted
// entries) and pushed back so both ends converge.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { stripHarakat } from './stripHarakat.js'
import {
  createLocalProvider,
  emptyEnvelope,
  envelopeContentSerial,
  mergeEnvelopes,
} from './sync/index.js'
import { notify } from './notify.js'

const DRIVE_DEBOUNCE_MS = 1500

function makeId(blockIndex, wordIndex) {
  return `${blockIndex}:${wordIndex}`
}

function buildEntry(input, dataVersion) {
  const ar = input.ar || ''
  return {
    id: makeId(input.blockIndex, input.wordIndex),
    ar,
    arBase: stripHarakat(ar).trim(),
    en: input.en || '',
    blockIndex: input.blockIndex,
    wordIndex: input.wordIndex,
    sectionId: input.section?.id || null,
    sectionAr: input.section?.displayAr || '',
    sectionEn: input.section?.en || '',
    sectionKind: input.section?.kind || null,
    sectionBlockIndex: input.section?.blockIndex ?? null,
    addedAt: Date.now(),
    dataVersion: dataVersion || 'unknown',
  }
}

function envelopeWithEntry(prev, entry) {
  // Reject duplicates (same id) — bank is set-like.
  if (prev.entries.some((e) => e.id === entry.id)) return prev
  // Clear any existing tombstone for this id so re-add works after
  // delete/sync.
  const tombstones = { ...prev.tombstones }
  delete tombstones[entry.id]
  return {
    ...prev,
    entries: [...prev.entries, entry],
    tombstones,
    updatedAt: Date.now(),
  }
}

function envelopeWithTombstone(prev, id) {
  const idx = prev.entries.findIndex((e) => e.id === id)
  const stillThere = idx !== -1
  return {
    ...prev,
    entries: stillThere
      ? prev.entries.filter((e) => e.id !== id)
      : prev.entries,
    tombstones: { ...prev.tombstones, [id]: Date.now() },
    updatedAt: Date.now(),
  }
}

export function useWordBank({ dataVersion, drive } = {}) {
  // Local provider is always created and always persists. Even when
  // signed in we keep localStorage warm so signing out doesn't lose
  // anything.
  const localProvider = useMemo(
    () =>
      createLocalProvider({
        onError: () =>
          notify({
            kind: 'error',
            message:
              'Could not save to this browser (storage may be full or blocked).',
          }),
      }),
    [],
  )

  const [envelope, setEnvelope] = useState(emptyEnvelope())
  const [hydrated, setHydrated] = useState(false)
  // 'idle' | 'syncing' | 'error' — drive push/pull status.
  const [syncStatus, setSyncStatus] = useState('idle')
  const [lastSyncError, setLastSyncError] = useState(null)

  // Use a ref so async pushers always read the latest envelope without
  // restarting the debounce timer on every render.
  const envelopeRef = useRef(envelope)
  envelopeRef.current = envelope

  // Track the last-persisted canonical serialization. When envelope
  // updates result in identical canonical content (e.g. a cross-tab
  // storage event echoes back our own write), we skip the redundant
  // save; otherwise two tabs would ping-pong forever because every
  // merge bumps `updatedAt`.
  const lastLocalSerialRef = useRef(null)
  const lastDriveSerialRef = useRef(null)

  // ---- initial local hydration --------------------------------------
  useEffect(() => {
    let cancelled = false
    localProvider.load().then((env) => {
      if (cancelled) return
      // Seed the "last written" baseline so the first persist effect
      // doesn't re-write data that's already on disk. We compare on
      // content (sans `updatedAt`) so cross-tab echoes don't loop.
      lastLocalSerialRef.current = envelopeContentSerial(env)
      setEnvelope(env)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [localProvider])

  // ---- always-on local persistence ----------------------------------
  useEffect(() => {
    if (!hydrated) return
    const serial = envelopeContentSerial(envelope)
    if (serial === lastLocalSerialRef.current) return
    lastLocalSerialRef.current = serial
    localProvider.save(envelope).catch(() => {
      // onError in the provider already notified; nothing else to do.
    })
  }, [envelope, hydrated, localProvider])

  // ---- cross-tab sync (storage events) ------------------------------
  useEffect(() => {
    return localProvider.subscribe((remoteEnv) => {
      setEnvelope((cur) => mergeEnvelopes(cur, remoteEnv))
    })
  }, [localProvider])

  // ---- drive sync (active when signed in) ---------------------------
  const driveProvider = drive?.provider || null

  // Pull-and-merge ceremony when drive becomes available. We track the
  // serialized form we just persisted so the debounced push effect
  // doesn't immediately upload the same bytes we just downloaded.
  useEffect(() => {
    if (!driveProvider || !hydrated) return
    let cancelled = false
    setSyncStatus('syncing')
    setLastSyncError(null)
    driveProvider
      .load()
      .then((remote) => {
        if (cancelled) return
        setEnvelope((cur) => {
          const merged = mergeEnvelopes(cur, remote)
          const mergedSerial = envelopeContentSerial(merged)
          // Only push back if the merge actually produced something
          // different from what's already on the remote.
          const remoteSerial = envelopeContentSerial(remote)
          if (mergedSerial !== remoteSerial) {
            driveProvider
              .save(merged)
              .then(() => {
                if (cancelled) return
                lastDriveSerialRef.current = mergedSerial
                setSyncStatus('idle')
              })
              .catch((err) => {
                if (cancelled) return
                setSyncStatus('error')
                setLastSyncError(err?.message || 'sync_failed')
                notify({
                  kind: 'warn',
                  message: 'Could not sync to Google Drive.',
                })
              })
          } else {
            lastDriveSerialRef.current = remoteSerial
            setSyncStatus('idle')
          }
          return merged
        })
      })
      .catch((err) => {
        if (cancelled) return
        setSyncStatus('error')
        setLastSyncError(err?.message || 'sync_failed')
        notify({
          kind: 'warn',
          message: 'Could not load your saved words from Google Drive.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [driveProvider, hydrated])

  // Push to drive (debounced) on every local mutation while signed in.
  // Skips no-op writes by comparing the canonical form to the last
  // successful upload — important because the cross-tab merge bumps
  // `updatedAt` even when entries don't change.
  const pushTimer = useRef(null)
  useEffect(() => {
    if (!driveProvider || !hydrated) return
    const serial = envelopeContentSerial(envelope)
    if (serial === lastDriveSerialRef.current) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      const currentSerial = envelopeContentSerial(envelopeRef.current)
      if (currentSerial === lastDriveSerialRef.current) return
      setSyncStatus('syncing')
      try {
        await driveProvider.save(envelopeRef.current)
        lastDriveSerialRef.current = currentSerial
        setSyncStatus('idle')
        setLastSyncError(null)
      } catch (err) {
        if (err?.code === 'etag_mismatch') {
          // Someone else wrote in between. Pull, merge, push again.
          try {
            const remote = await driveProvider.load()
            setEnvelope((cur) => {
              const merged = mergeEnvelopes(cur, remote)
              const mergedSerial = envelopeContentSerial(merged)
              driveProvider
                .save(merged)
                .then(() => {
                  lastDriveSerialRef.current = mergedSerial
                })
                .catch(() => {})
              return merged
            })
            setSyncStatus('idle')
            setLastSyncError(null)
          } catch (err2) {
            setSyncStatus('error')
            setLastSyncError(err2?.message || 'sync_failed')
          }
        } else {
          setSyncStatus('error')
          setLastSyncError(err?.message || 'sync_failed')
        }
      }
    }, DRIVE_DEBOUNCE_MS)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [envelope, driveProvider, hydrated])

  // Subscribe to remote changes (poll Drive modifiedTime).
  useEffect(() => {
    if (!driveProvider) return
    return driveProvider.subscribe((remoteEnv) => {
      setEnvelope((cur) => mergeEnvelopes(cur, remoteEnv))
    })
  }, [driveProvider])

  // ---- mutators (stable identity for downstream memos) --------------
  const hasWord = useCallback(
    (blockIndex, wordIndex) => {
      const id = makeId(blockIndex, wordIndex)
      return envelope.entries.some((e) => e.id === id)
    },
    [envelope.entries],
  )

  const addWord = useCallback(
    (input) => {
      setEnvelope((prev) =>
        envelopeWithEntry(prev, buildEntry(input, dataVersion)),
      )
    },
    [dataVersion],
  )

  const removeWord = useCallback((blockIndex, wordIndex) => {
    setEnvelope((prev) =>
      envelopeWithTombstone(prev, makeId(blockIndex, wordIndex)),
    )
  }, [])

  const removeById = useCallback((id) => {
    setEnvelope((prev) => envelopeWithTombstone(prev, id))
  }, [])

  const clearAll = useCallback(() => {
    setEnvelope((prev) => {
      const tombstones = { ...prev.tombstones }
      const now = Date.now()
      for (const e of prev.entries) tombstones[e.id] = now
      return {
        ...prev,
        entries: [],
        tombstones,
        updatedAt: now,
      }
    })
  }, [])

  // ---- derived views ------------------------------------------------
  const entries = envelope.entries

  const groupedBySection = useMemo(() => {
    const groups = new Map()
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
      const arBase = e.arBase || stripHarakat(e.ar || '').trim()
      if (!group.words.has(arBase)) {
        group.words.set(arBase, {
          arBase,
          ar: e.ar,
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
    list.sort((a, b) => {
      const ax = a.sectionBlockIndex ?? -1
      const bx = b.sectionBlockIndex ?? -1
      return ax - bx
    })
    return list
  }, [entries])

  const csvRows = useMemo(() => {
    const seen = new Set()
    const rows = []
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
      const arBase = e.arBase || stripHarakat(e.ar || '').trim()
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

  // Count entries pinned to a different corpus version than the one
  // currently loaded — their "Jump to source" links may be off.
  const staleCount = useMemo(() => {
    if (!dataVersion) return 0
    let n = 0
    for (const e of entries) {
      if (e.dataVersion && e.dataVersion !== 'unknown' && e.dataVersion !== dataVersion) {
        n += 1
      }
    }
    return n
  }, [entries, dataVersion])

  return {
    // state
    envelope,
    entries,
    count: entries.length,
    hydrated,
    staleCount,
    syncStatus,
    lastSyncError,
    // queries
    hasWord,
    // mutations
    addWord,
    removeWord,
    removeById,
    clearAll,
    // derived
    groupedBySection,
    csvRows,
  }
}

export default useWordBank
