import { requireOptionalNativeModule } from 'expo-modules-core'

// Android-only module in modules/songkhem-haptics: vibrates tagged as accessibility feedback so phones with
// "Touch feedback" turned off still buzz. Missing (iOS, or an older build) -> callers fall back to Vibration.
const Native = requireOptionalNativeModule('SongkhemHaptics')

/** @returns {boolean} true when the native module handled it */
export const vibratePattern = (pattern) => {
  if (!Native) return false
  try {
    Native.vibrate(pattern)
    return true
  } catch (e) {
    return false
  }
}

// android.os.VibrationEffect ids for the phone's built-in effects
export const EFFECT = { CLICK: 0, DOUBLE_CLICK: 1, TICK: 2, HEAVY_CLICK: 5 }

/**
 * Plays the phone's own click / tick effects: [[effectId, startMs], ...]. Plain timed buzzes are barely
 * felt on linear-motor phones, these are crisp. @returns {boolean} false when unsupported (use a buzz instead)
 */
export const playEffects = (steps) => {
  if (!Native || !Native.playEffects) return false
  try {
    return Native.playEffects(steps) === true
  } catch (e) {
    return false
  }
}
