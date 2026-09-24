/**
 * Haptic Feedback Service (Port & Adapter)
 * Conforms to .agents/ProjectInstruction.md §5.2
 * Single Responsibility: Delivers tactile feedback patterns safely.
 */

// Canonical vibration patterns (in ms)
export const HAPTIC_PATTERNS = {
  tap: [30],
  selection: [40],
  aligned: [40, 30],
  success: [80, 40, 100],
  warning: [100, 50],
  error: [100, 60, 100],
  shutter: [60, 40, 80],
  toggle: [30, 30]
}

class HapticsService {
  constructor() {
    this._enabled = true
  }

  setEnabled(enabled) {
    this._enabled = Boolean(enabled)
  }

  isEnabled() {
    return this._enabled
  }

  /**
   * Trigger a tactile pulse pattern
   * @param {'tap'|'selection'|'aligned'|'success'|'warning'|'error'|'shutter'|'toggle'|number[]} pattern
   */
  pulse(pattern = 'tap') {
    if (!this._enabled) return
    if (typeof window === 'undefined' || !navigator.vibrate) return

    try {
      const vibPattern = Array.isArray(pattern) ? pattern : (HAPTIC_PATTERNS[pattern] || [40])
      navigator.vibrate(vibPattern)
    } catch {
      // Graceful fallback on unsupported or locked devices
    }
  }
}

export const haptics = new HapticsService()
