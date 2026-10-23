/**
 * Focus management for modal dialogs: focus moves into the dialog when it opens, Tab and
 * Shift+Tab stay inside it, and focus returns to whatever opened it when it closes.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const visibleFocusables = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el.classList.contains('sr-only'))

export function trapFocus(root) {
  const opener = document.activeElement
  // The dialog itself takes focus (not its first button), so the screen reader announces the
  // dialog by name and Tab then moves to the first control.
  root.setAttribute('tabindex', '-1')
  root.style.outline = 'none'
  root.focus({ preventScroll: true })

  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return
    const items = visibleFocusables(root)
    if (!items.length) {
      e.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    } else if (!root.contains(active)) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', onKeyDown, true)

  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
  }
}

/** v-focus-trap */
export const vFocusTrap = {
  mounted(el) {
    el.__releaseFocusTrap = trapFocus(el)
  },
  unmounted(el) {
    if (el.__releaseFocusTrap) el.__releaseFocusTrap()
  },
}
