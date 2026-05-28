// Manages the user's signed-in state for Google Drive sync.
//
// Responsibilities:
//   - Track the active access token and its expiry.
//   - Fetch / refresh tokens on demand via `getAccessToken()`.
//   - Persist a *display* profile (name/email/picture) in localStorage
//     so the toolbar shows the right thing on reload — but never
//     persist tokens (they're memory-only by design).
//   - Expose explicit `signIn()` / `signOut()` for the UI.
//
// On load, if a cached profile exists we attempt a *silent* token
// request: if the user previously consented and their session is still
// valid, this succeeds with no UI. If it doesn't, we fall back to the
// "signed out" state and the user can click sign-in to re-authorize.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearIdentity,
  fetchProfile,
  isConfigured,
  loadCachedProfile,
  requestAccessToken,
  saveCachedProfile,
} from './googleAuth.js'

export function useGoogleAuth({ onError } = {}) {
  const configured = isConfigured()
  const [profile, setProfile] = useState(() =>
    configured ? loadCachedProfile() : null,
  )
  const [status, setStatus] = useState(
    configured && loadCachedProfile() ? 'restoring' : 'signed_out',
  )
  const tokenRef = useRef(null) // { accessToken, expiresAt }
  const refreshInFlight = useRef(null)
  // Bumped on every signOut so tokens that arrive *after* sign-out
  // (because the GIS popup or silent re-auth resolved late) are
  // rejected instead of silently rehydrating the auth state.
  const sessionEpoch = useRef(0)

  const acquireToken = useCallback(async (silent) => {
    const myEpoch = sessionEpoch.current
    const t = await requestAccessToken({ silent })
    if (myEpoch !== sessionEpoch.current) {
      throw new Error('signed_out_during_auth')
    }
    tokenRef.current = t
    return t.accessToken
  }, [])

  const getAccessToken = useCallback(async () => {
    const cur = tokenRef.current
    if (cur && cur.expiresAt > Date.now()) return cur.accessToken
    if (refreshInFlight.current) return refreshInFlight.current
    refreshInFlight.current = (async () => {
      try {
        return await acquireToken(true)
      } finally {
        refreshInFlight.current = null
      }
    })()
    return refreshInFlight.current
  }, [acquireToken])

  // On mount, if we believe the user is signed-in, attempt silent
  // token acquisition. If that fails we fall back to signed-out so
  // the UI can prompt the user to re-authorize.
  useEffect(() => {
    if (!configured) return
    const cached = loadCachedProfile()
    if (!cached) return
    let cancelled = false
    ;(async () => {
      try {
        await acquireToken(true)
        if (cancelled) return
        setProfile(cached)
        setStatus('signed_in')
      } catch {
        if (cancelled) return
        // Silent re-auth declined — keep the cached profile *out* of
        // state so the UI shows "Sign in" and not the user's name.
        clearIdentity()
        setProfile(null)
        setStatus('signed_out')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configured, acquireToken])

  const signIn = useCallback(async () => {
    if (!configured) return
    setStatus('signing_in')
    try {
      const accessToken = await acquireToken(false)
      const fetched = await fetchProfile(accessToken)
      const next = fetched || loadCachedProfile() || { name: 'Signed in' }
      if (fetched) saveCachedProfile(fetched)
      setProfile(next)
      setStatus('signed_in')
    } catch (err) {
      setStatus('signed_out')
      tokenRef.current = null
      if (onError) onError(err)
    }
  }, [configured, onError, acquireToken])

  const signOut = useCallback(() => {
    sessionEpoch.current += 1
    tokenRef.current = null
    clearIdentity()
    setProfile(null)
    setStatus('signed_out')
  }, [])

  return {
    configured,
    status,         // 'restoring' | 'signing_in' | 'signed_in' | 'signed_out'
    profile,        // { name, email, picture } | null
    signIn,
    signOut,
    getAccessToken, // async () => string  (only valid while signed_in)
    isSignedIn: status === 'signed_in',
  }
}

export default useGoogleAuth
