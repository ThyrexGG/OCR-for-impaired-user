import { useId, useRef, useSyncExternalStore } from 'react'
import { Pressable } from 'react-native'
import { useApp } from '../context/AppContext'
import { getArmedKey, setArmedKey, speakNow, subscribeArmed } from '../services/talkback'
import { TP } from '../services/talkPhrases'

// Drawn around the control that was just read out, so sighted helpers can see which
// one the next tap will open.
const FOCUS_RING = { outlineWidth: 3, outlineColor: '#4466F6', outlineOffset: 2 }

/**
 * Every interactive element in the app goes through this, which is where talk-back lives:
 *
 *  - Explore mode (default): the first tap only reads the control out (on touch-down, so the
 *    voice starts with the finger, not after the lift), the second tap on the same control
 *    activates it. Nothing destructive can fire by accident.
 *  - Voice on, explore off: a tap reads the label and activates in one go.
 *  - Voice off, or the OS screen reader running: plain button; TalkBack / VoiceOver does the
 *    talking and its own double-tap-to-activate through the accessibility props.
 */
export default function AccessiblePressable({
  onPress,
  onPressIn,
  accessibilityLabel,
  accessibilityState,
  hapticIntensity = 'light',
  speakOnPress = true,
  disabled = false,
  style,
  children,
  ...rest
}) {
  const { triggerHaptic, isExploreActive, isTalkbackActive } = useApp()
  const key = useId()
  const isArmed = useSyncExternalStore(subscribeArmed, () => getArmedKey() === key)
  const justArmed = useRef(false)

  const describe = () => {
    const parts = [accessibilityLabel]
    if (accessibilityState?.checked !== undefined) parts.push(accessibilityState.checked ? TP.stateOn.km : TP.stateOff.km)
    if (accessibilityState?.selected) parts.push(TP.stateSelected.km)
    if (disabled) parts.push(TP.stateDisabled.km)
    return parts.filter(Boolean)
  }

  const handlePressIn = (e) => {
    onPressIn?.(e)
    justArmed.current = false
    if (!accessibilityLabel) return

    if (isExploreActive) {
      // Second tap on the control that was just announced: it is about to activate, say nothing
      if (getArmedKey() === key && !disabled) return
      justArmed.current = true
      triggerHaptic('selection')
      setArmedKey(key)
      speakNow(describe())
      return
    }
    if (isTalkbackActive && speakOnPress && !disabled) speakNow(accessibilityLabel)
  }

  const handlePress = (e) => {
    if (disabled) return
    if (isExploreActive && accessibilityLabel) {
      if (justArmed.current) {
        justArmed.current = false
        return
      }
      setArmedKey(null)
    }
    triggerHaptic(hapticIntensity)
    onPress?.(e)
  }

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
      onPressIn={handlePressIn}
      onPress={handlePress}
      style={(state) => [typeof style === 'function' ? style(state) : style, isArmed && FOCUS_RING]}
      {...rest}
    >
      {children}
    </Pressable>
  )
}
