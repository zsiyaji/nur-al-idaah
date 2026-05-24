// Capture & restore a "topmost visible block" so settings toggles (which
// resize blocks above the reader) don't jump the user to a different
// part of the document.
//
// Usage:
//   const anchor = captureBlockAnchor()
//   ... change state that re-renders blocks ...
//   useLayoutEffect(() => { restoreBlockAnchor(anchor) }, [deps])

// Estimate the bottom edge of the sticky toolbar so we pick the block
// the user is *actually* reading (not one tucked behind the toolbar).
function getToolbarBottom() {
  const tb = document.querySelector('[data-toolbar]')
  if (!tb) return 0
  return tb.getBoundingClientRect().bottom
}

export function captureBlockAnchor() {
  if (typeof document === 'undefined') return null
  const toolbarBottom = getToolbarBottom()
  const blocks = document.querySelectorAll('[data-block-index]')
  for (const el of blocks) {
    const rect = el.getBoundingClientRect()
    // First block whose bottom is past the toolbar = topmost block the
    // user is currently reading (may be partially scrolled off the top).
    if (rect.bottom > toolbarBottom + 1) {
      return {
        blockIndex: el.getAttribute('data-block-index'),
        top: rect.top,
      }
    }
  }
  return null
}

export function restoreBlockAnchor(anchor) {
  if (!anchor || typeof document === 'undefined') return
  const el = document.querySelector(
    `[data-block-index="${anchor.blockIndex}"]`,
  )
  if (!el) return
  const rect = el.getBoundingClientRect()
  const delta = rect.top - anchor.top
  if (Math.abs(delta) < 0.5) return
  // Use scrollBy with auto (instant) behaviour so the user doesn't see
  // a visible jump; this runs inside useLayoutEffect, before paint.
  window.scrollBy({ top: delta, left: 0, behavior: 'auto' })
}
