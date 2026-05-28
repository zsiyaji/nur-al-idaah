// Tiny pub/sub-based toast queue. Components anywhere in the tree can
// `notify({ kind, message })`; the <Toast> mounted in App listens.
// Kept dependency-free to preserve the "one-fetch SPA" deploy model.
import { useEffect, useState } from 'react'

const listeners = new Set()
let nextId = 1

const ALLOWED_KINDS = new Set(['info', 'success', 'warn', 'error'])

export function notify({ kind = 'info', message, ttl = 4000 }) {
  const item = {
    id: nextId++,
    kind: ALLOWED_KINDS.has(kind) ? kind : 'info',
    // Coerce so a stray non-string can't render as `[object Object]`
    // (or, worse, contribute object identity to a key collision).
    message: message == null ? '' : String(message),
    ttl: Number.isFinite(ttl) && ttl >= 0 ? ttl : 4000,
  }
  for (const fn of listeners) fn(item)
  return item.id
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useToasts() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const unsub = subscribe((item) => {
      setItems((prev) => [...prev, item])
      if (item.ttl > 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== item.id))
        }, item.ttl)
      }
    })
    return unsub
  }, [])
  const dismiss = (id) =>
    setItems((prev) => prev.filter((i) => i.id !== id))
  return { items, dismiss }
}
