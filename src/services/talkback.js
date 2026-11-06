/**
 * Talk-back for the web app: spoken feedback for touch and keyboard users who are not running
 * an OS screen reader (the native counterpart is mobile/src/components/AccessiblePressable.js).
 *
 *  - Touch + explore mode (default): the first tap on a control reads it out, on pointer-down so
 *    the voice starts with the finger; the second tap on the same control activates it. Nothing
 *    can fire by accident, and a scroll gesture cuts the speech off.
 *  - Touch with explore off: a tap reads the label and activates in one go.
 *  - Keyboard: moving focus with Tab reads the control; Enter / Space act as usual.
 *  - Mouse: a click reads the label and acts (the original click-to-speak behaviour).
 */
import { announcer } from './announcer'
import { currentLang } from './i18n'
import { TP } from './talkPhrases'

export const tp = (key) => TP[key]?.[currentLang.value === 'km' ? 'km' : 'en'] || ''

const INTERACTIVE =
  'button, a[href], summary, input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], .action-card, .mode-tab'
const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, select'
const ARM_WINDOW_MS = 6000
const ARMED_CLASS = 'tb-armed'

// Words of the document are tap-to-seek targets, not controls to describe: they act immediately
const closestInteractive = (target) => {
  if (!(target instanceof Element)) return null
  const el = target.closest(INTERACTIVE)
  return el && !el.closest('[data-talkback="off"]') ? el : null
}

const textOf = (el) => (el.innerText || el.textContent || '').trim()

const labelOf = (el) => {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const text = by
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map(textOf)
      .join(' ')
    if (text) return text
  }
  if (el.matches('input, select, textarea')) {
    const labelled = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
    return (labelled && textOf(labelled)) || el.getAttribute('placeholder') || el.getAttribute('title') || ''
  }
  const img = el.querySelector('img[alt]')
  return textOf(el) || el.getAttribute('title') || (img && img.alt) || ''
}

/** What to say for a control: its name, then its state when it has one. */
export const describe = (el) => {
  const parts = [labelOf(el)]
  const checked = el.getAttribute('aria-checked') ?? el.getAttribute('aria-pressed')
  if (checked === 'true' || el.checked === true) parts.push(tp('stateOn'))
  else if (checked === 'false' || el.checked === false) parts.push(tp('stateOff'))
  if (el.getAttribute('aria-selected') === 'true') parts.push(tp('stateSelected'))
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') parts.push(tp('stateDisabled'))
  return parts.filter(Boolean)
}

/**
 * @param {{ isVoiceOn: () => boolean, isExploreOn: () => boolean }} options
 * @returns {() => void} uninstall
 */
export function installTalkback({ isVoiceOn, isExploreOn }) {
  let lastPointerType = ''
  let lastPointerAt = 0
  let lastKeyAt = 0
  let armedEl = null
  let armTimer = null
  let justArmed = false
  let spokeOnThisPointer = false

  const disarm = () => {
    clearTimeout(armTimer)
    if (armedEl) armedEl.classList.remove(ARMED_CLASS)
    armedEl = null
    justArmed = false
  }

  const arm = (el) => {
    disarm()
    armedEl = el
    el.classList.add(ARMED_CLASS)
    armTimer = setTimeout(disarm, ARM_WINDOW_MS)
  }

  const isTouchLike = () => (lastPointerType === 'touch' || lastPointerType === 'pen') && Date.now() - lastPointerAt < 1500

  const onPointerUp = (e) => {
    lastPointerType = e.pointerType
    lastPointerAt = Date.now()
  }

  const onPointerDown = (e) => {
    lastPointerType = e.pointerType
    lastPointerAt = Date.now()
    spokeOnThisPointer = false
    justArmed = false
    if (!isVoiceOn() || e.pointerType === 'mouse') return
    const el = closestInteractive(e.target)
    if (!el) return

    if (el.matches(TEXT_ENTRY)) {
      // A text field must still take focus on the first tap: read it, never hold it back
      announcer.speak(describe(el))
      spokeOnThisPointer = true
      return
    }
    if (isExploreOn()) {
      if (armedEl === el) return // second tap on the control just announced: let it activate
      arm(el)
      justArmed = true
    }
    spokeOnThisPointer = true
    announcer.speak(describe(el))
  }

  // The browser takes the touch over for scrolling: that was not a tap, so be quiet.
  const onPointerCancel = () => {
    if (spokeOnThisPointer) announcer.stop()
    spokeOnThisPointer = false
    justArmed = false
    disarm()
  }

  const onClick = (e) => {
    if (!isVoiceOn()) return
    const el = closestInteractive(e.target)
    if (!el) return

    if (isTouchLike() && isExploreOn() && !el.matches(TEXT_ENTRY)) {
      if (justArmed) {
        // First tap: it only announced the control
        e.preventDefault()
        e.stopImmediatePropagation()
        justArmed = false
        return
      }
      disarm()
      return
    }
    // Mouse clicks read the label; touch already did on pointer-down and keyboard on focus
    if (!isTouchLike() && e.detail > 0) announcer.speak(describe(el))
  }

  const onKeyDown = () => {
    lastKeyAt = Date.now()
  }

  const onFocusIn = (e) => {
    if (!isVoiceOn() || Date.now() - lastKeyAt > 700) return
    const el = closestInteractive(e.target)
    if (el) announcer.speak(describe(el))
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerCancel, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('focusin', onFocusIn, true)

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('pointerup', onPointerUp, true)
    document.removeEventListener('pointercancel', onPointerCancel, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('focusin', onFocusIn, true)
    disarm()
  }
}
