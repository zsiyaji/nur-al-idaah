import { useEffect, useState, useCallback } from 'react'

const KEY = 'nai.settings.v1'

export const DEFAULTS = {
  arabic: true,
  wbw: false,
  translation: true,
  iraab: true, // show harakat by default
  dark: false,
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch {}
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    if (settings.dark) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [settings.dark])

  const update = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const toggle = useCallback((key) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }))
  }, [])

  const reset = useCallback(() => setSettings({ ...DEFAULTS }), [])

  return { settings, update, toggle, reset }
}

export default useSettings
