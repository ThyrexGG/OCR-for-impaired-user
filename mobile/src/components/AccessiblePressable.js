import { Pressable } from 'react-native'
import { useApp } from '../context/AppContext'

/**
 * Replaces the web app's global `document.addEventListener('click', ...)`
 * speak-on-click delegation (App.vue) — RN has no DOM event delegation, so
 * every interactive element that wants "speak what I tapped" behavior wraps
 * itself in this instead of a raw Pressable.
 */
export default function AccessiblePressable({
  onPress,
  accessibilityLabel,
  hapticIntensity = 'light',
  speakOnPress = true,
  disabled = false,
  children,
  ...rest
}) {
  const { triggerHaptic, speakAccessibility } = useApp()

  const handlePress = (e) => {
    if (disabled) return
    triggerHaptic(hapticIntensity)
    if (speakOnPress && accessibilityLabel) {
      speakAccessibility(accessibilityLabel, true)
    }
    onPress?.(e)
  }

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      {...rest}
    >
      {children}
    </Pressable>
  )
}
