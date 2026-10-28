import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertCircle, CheckCircle2, Info, RotateCcw, X, Zap } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import AccessiblePressable from './AccessiblePressable'
import { navigationRef } from '../navigation/navigationRef'

const ICONS = { cache: Zap, success: CheckCircle2, warning: AlertCircle, info: Info }
const ICON_COLOR_KEY = { cache: 'accent', success: 'success', warning: 'warning', info: 'info' }

/**
 * Ports AppToast.vue. Mounted once at the app root (above the bottom tab
 * bar) so toasts are visible regardless of which tab is active.
 */
export default function ToastHost() {
  const { colors, fonts } = useTheme()
  const { toasts, dismissToast } = useApp()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)
  // The reader has a taller player bar than the tab bar: keep toasts above it, off the progress bar and buttons
  const [onReader, setOnReader] = useState(false)
  useEffect(
    () => navigationRef.addListener('state', () => setOnReader(navigationRef.getCurrentRoute()?.name === 'Reader')),
    []
  )

  if (toasts.length === 0) return null

  return (
    <View style={[styles.container, { bottom: (onReader ? 210 : 84) + insets.bottom }]} pointerEvents="box-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info
        const iconColor = t.type === 'warning' ? '#F59E0B' : t.type === 'info' ? '#60A5FA' : t.type === 'success' ? colors.success : colors.accent
        return (
          <View key={t.id} style={styles.pill} accessibilityLiveRegion="polite">
            <Icon size={18} color={iconColor} />
            <Text style={[styles.message, { fontFamily: fonts.khmer }]}>{t.message}</Text>
            {!!t.actionLabel && (
              <AccessiblePressable
                style={styles.actionBtn}
                accessibilityLabel={t.actionLabel}
                onPress={() => {
                  t.onAction?.()
                  dismissToast(t.id)
                }}
              >
                <RotateCcw size={13} color={colors.accentText} />
                <Text style={[styles.actionText, { fontFamily: fonts.khmer }]}>{t.actionLabel}</Text>
              </AccessiblePressable>
            )}
            <AccessiblePressable style={styles.closeBtn} accessibilityLabel="បិទការជូនដំណឹង (Close Toast)" speakOnPress={false} onPress={() => dismissToast(t.id)}>
              <X size={14} color={colors.textMuted} />
            </AccessiblePressable>
          </View>
        )
      })}
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 16,
      right: 16,
      alignItems: 'center',
      gap: 8,
      zIndex: 1000,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.bgSurface,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      borderRadius: colors.radii.full,
      maxWidth: '100%',
      ...colors.shadows.lg,
    },
    message: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 10,
      backgroundColor: colors.accent,
      borderRadius: colors.radii.full,
    },
    actionText: { color: colors.accentText, fontSize: 11, fontWeight: '800' },
    closeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  })
