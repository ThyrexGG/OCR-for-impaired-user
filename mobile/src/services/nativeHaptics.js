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
