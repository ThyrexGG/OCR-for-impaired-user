import { View } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from './AccessiblePressable'

/**
 * Pill button in the web app's current design (src/style.css `--radius-button:
 * 9999px`): fully rounded, soft elevation instead of the old hard offset
 * shadow, and a gentle press (scale + dim). The prop names (offsetX/offsetY,
 * borderColor, shadowColor...) are kept so existing call sites keep working;
 * the hard-shadow ones are simply ignored now.
 */
export default function NeoButton({
  children,
  style,
  contentStyle,
  bg = '#FFFFFF',
  radius = 9999,
  disabled = false,
  // legacy neobrutalist props, accepted and ignored
  // eslint-disable-next-line no-unused-vars
  borderColor,
  // eslint-disable-next-line no-unused-vars
  shadowColor,
  // eslint-disable-next-line no-unused-vars
  offsetX,
  // eslint-disable-next-line no-unused-vars
  offsetY,
  // eslint-disable-next-line no-unused-vars
  borderWidth,
  ...rest
}) {
  const { currentTheme } = useTheme()
  const edge = currentTheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)'

  return (
    <View style={style}>
      <AccessiblePressable
        disabled={disabled}
        style={({ pressed }) => [
          {
            backgroundColor: disabled ? '#94A3B8' : bg,
            borderWidth: 1,
            borderColor: edge,
            borderRadius: radius,
            opacity: pressed && !disabled ? 0.88 : 1,
            transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: currentTheme === 'dark' ? 0 : 0.12,
            shadowRadius: 8,
            elevation: currentTheme === 'dark' ? 0 : 3,
          },
          contentStyle,
        ]}
        {...rest}
      >
        {children}
      </AccessiblePressable>
    </View>
  )
}
