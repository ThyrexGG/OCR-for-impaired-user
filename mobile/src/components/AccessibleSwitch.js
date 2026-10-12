import { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from './AccessiblePressable'

// Ports App.vue's `.accessible-switch` — a custom toggle rather than RN's
// built-in <Switch>, to match the app's own visual design system exactly.
export default function AccessibleSwitch({ value, onValueChange, accessibilityLabel }) {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: false }).start()
  }, [value, anim])

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] })

  return (
    <AccessiblePressable
      style={[styles.track, value && styles.trackOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      speakOnPress={false}
      onPress={() => onValueChange(!value)}
    >
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
    </AccessiblePressable>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    track: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      justifyContent: 'center',
    },
    trackOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    thumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#FFFFFF',
    },
  })
