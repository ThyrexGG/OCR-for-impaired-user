import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from './AccessiblePressable'

// Ports App.vue's `.segment-buttons` group used for the line-spacing picker.
export default function PillSegmented({ options, value, onChange }) {
  const { colors } = useTheme()
  const styles = createStyles(colors)

  return (
    <View style={styles.row}>
      {options.map((opt) => (
        <AccessiblePressable
          key={opt.value}
          style={[styles.segment, value === opt.value && styles.segmentActive]}
          accessibilityLabel={opt.label}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.segmentText, value === opt.value && { color: colors.accentText }]}>{opt.label}</Text>
        </AccessiblePressable>
      ))}
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    segment: {
      minHeight: 40,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      borderRadius: colors.radii.sm,
    },
    segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  })
