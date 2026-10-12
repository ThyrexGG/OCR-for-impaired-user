import { View } from 'react-native'
import AccessiblePressable from './AccessiblePressable'

/**
 * The web app's "neobrutalist" hard-offset-shadow button (`box-shadow: -4px
 * 4px 0px #0F172A`, translate-to-flush on `:active`) — used almost
 * everywhere (App.css header buttons, DocumentUploader/OcrPanel/TtsPanel's
 * hero + choose-file buttons). RN's shadow* props always blur, so this is a
 * literal second rectangle behind the button, nudged by (offsetX, offsetY)
 * and revealed because the wrapping View doesn't clip by default. On press,
 * the front button slides onto the shadow (offset -> 0) to read as "pushed in".
 */
export default function NeoButton({
  children,
  style,
  contentStyle,
  bg = '#FFFFFF',
  borderColor = '#0F172A',
  shadowColor = '#1D4ED8',
  offsetX = -4,
  offsetY = 4,
  borderWidth = 2,
  radius = 4,
  disabled = false,
  ...rest
}) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: disabled ? borderColor + '55' : shadowColor,
          borderRadius: radius,
          transform: [{ translateX: offsetX }, { translateY: offsetY }],
        }}
      />
      <AccessiblePressable
        disabled={disabled}
        style={({ pressed }) => [
          {
            backgroundColor: bg,
            borderWidth,
            borderColor,
            borderRadius: radius,
            opacity: disabled ? 0.6 : 1,
            transform: pressed && !disabled ? [{ translateX: offsetX }, { translateY: offsetY }] : [{ translateX: 0 }, { translateY: 0 }],
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
