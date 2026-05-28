import React, { useEffect, useRef, useState } from 'react'

// Small toolbar control for Google Drive sync. Renders nothing if the
// build wasn't given a `VITE_GOOGLE_CLIENT_ID` (so unconfigured forks
// quietly stay anonymous-only).
//
// States:
//   - signed_out: "Sign in" button → calls auth.signIn()
//   - restoring / signing_in: spinning indicator
//   - signed_in: avatar / initial; click opens a small menu with
//     account info + sign-out.
export default function SyncButton({ auth, configured }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!configured) return null

  const status = auth.status
  const profile = auth.profile

  if (status === 'signed_out' || (!profile && status !== 'signing_in' && status !== 'restoring')) {
    return (
      <button
        type="button"
        onClick={auth.signIn}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        title="Sign in with Google to sync your word bank across devices"
      >
        <GoogleGlyph />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    )
  }

  if (status === 'signing_in' || status === 'restoring') {
    return (
      <div
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm text-slate-500 dark:text-slate-400"
        title="Connecting to Google…"
      >
        <Spinner />
        <span className="hidden sm:inline">Connecting…</span>
      </div>
    )
  }

  // signed_in
  const initial =
    (profile?.name && profile.name.trim().charAt(0).toUpperCase()) ||
    (profile?.email && profile.email.trim().charAt(0).toUpperCase()) ||
    '·'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-9 px-2 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          profile?.email
            ? `Signed in as ${profile.email} — click to manage`
            : 'Account menu'
        }
      >
        {profile?.picture ? (
          <img
            src={profile.picture}
            alt=""
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <span className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-semibold">
            {initial}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-ink-900 shadow-lg p-3"
        >
          <div className="flex items-center gap-3 mb-2">
            {profile?.picture ? (
              <img
                src={profile.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-emerald-700 text-white text-sm font-semibold">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              {profile?.name && (
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {profile.name}
                </div>
              )}
              {profile?.email && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {profile.email}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mb-3">
            Your word bank is synced to a hidden, app-only folder in your
            Google Drive. We never see your data.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              auth.signOut()
            }}
            className="w-full inline-flex items-center justify-center h-9 rounded-md text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GoogleGlyph() {
  // Simplified multicolor "G" mark.
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.8-2 13.3-5.3l-6.1-5c-2 1.4-4.4 2.3-7.2 2.3-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.7l6.1 5c-.4.4 6.7-4.9 6.7-14.7 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}
