// Thin wrapper around Google Identity Services (GIS) for the implicit
// "token client" flow. This is the lightest path that works from a
// pure static SPA on GitHub Pages: no backend, no client secret,
// short-lived access tokens held only in memory.
//
// We deliberately request just `drive.appdata` — a non-sensitive
// scope that lets the app read/write a hidden folder owned by us
// inside the user's Drive. We never see the user's other files.
//
// Profile (name/email/picture) is fetched from Drive's `about` endpoint
// after auth, which is included with the `drive.appdata` scope — so we
// don't have to ask for `openid email profile` separately.
//
// Token lifetime is ~1h. We attempt silent re-auth (`prompt: ''`) on
// expiry; if that fails the user has to click sign-in again.

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const PROFILE_KEY = 'nai.google.profile.v1'

let scriptPromise = null

function loadGIS() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('gis_script_error')),
      )
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gis_script_error'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function isConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
}

export function loadCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    // Allow-list fields and coerce to strings so a corrupted blob
    // can't smuggle non-string values into the toolbar render.
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      picture: typeof parsed.picture === 'string' ? parsed.picture : '',
    }
  } catch {
    return null
  }
}

export function saveCachedProfile(profile) {
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(PROFILE_KEY)
  } catch {}
}

// Request an access token for Drive AppData. Returns
// { accessToken, expiresAt }. Throws on user-cancel / config error.
//
// `silent: true`  → request with prompt='none'. Succeeds only if the
//                   user previously consented and their Google session
//                   is still valid; otherwise rejects.
// `silent: false` → request with prompt='' (default). Google decides
//                   whether to show consent — first-ever sign-in shows
//                   it; subsequent sign-ins are usually silent.
export async function requestAccessToken({ silent } = {}) {
  if (!isConfigured()) throw new Error('not_configured')
  await loadGIS()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return new Promise((resolve, reject) => {
    let settled = false
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (settled) return
        settled = true
        if (resp.error) {
          reject(new Error(resp.error))
          return
        }
        if (!resp.access_token) {
          reject(new Error('no_token'))
          return
        }
        const expiresIn = Number(resp.expires_in) || 3600
        resolve({
          accessToken: resp.access_token,
          // Renew 60s early to avoid mid-request expiry.
          expiresAt: Date.now() + (expiresIn - 60) * 1000,
        })
      },
      error_callback: (err) => {
        if (settled) return
        settled = true
        reject(new Error(err?.type || 'auth_error'))
      },
    })
    client.requestAccessToken({ prompt: silent ? 'none' : '' })
  })
}

// Fetch the signed-in user's profile from Drive's `about` endpoint.
// `drive.appdata` scope grants access to `about.user` (this is documented
// behavior; no additional scope is required). Failures are non-fatal —
// the caller can still proceed with sync and just display a fallback.
export async function fetchProfile(accessToken) {
  try {
    const r = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!r.ok) return null
    const json = await r.json()
    const u = json?.user
    if (!u) return null
    return {
      name: u.displayName || '',
      email: u.emailAddress || '',
      picture: u.photoLink || '',
    }
  } catch {
    return null
  }
}

export function clearIdentity() {
  saveCachedProfile(null)
}

export const SCOPES = SCOPE
