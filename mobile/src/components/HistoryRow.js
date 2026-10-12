import { Share, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { BookOpen, Edit2, Play, Share2, Trash2 } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import AccessiblePressable from './AccessiblePressable'

const estimateDuration = (wordsCount) => {
  if (!wordsCount) return '~30 វិនាទី'
  const minutes = Math.ceil(wordsCount / 120)
  return `~${minutes} នាទី`
}

// Ports UserHistory.vue's `.history-list-row` at ≤640px: stacked info, then
// the "two-tier" 6-column action grid — Play + Open (3 cols each) on top,
// borderless Share / Rename / Delete icon tools (2 cols each) beneath.
export default function HistoryRow({ item, onRename }) {
  const { colors, fonts } = useTheme()
  const { triggerHaptic, speakAccessibility } = useApp()
  const { loadHistoryItem, quickPlayHistoryItem, deleteHistoryItem } = useOcr()
  const s = colors.surfaces
  const styles = createStyles(colors, s)

  const handleShare = async () => {
    triggerHaptic('light')
    if (!item.text) return
    try {
      await Share.share({ title: item.name, message: item.text })
      speakAccessibility(`បានចែករំលែកឯកសារ ${item.name}`)
    } catch (e) {
      await Clipboard.setStringAsync(item.text)
      speakAccessibility(`បានចម្លងអត្ថបទ ${item.name} ទៅកាន់ Clipboard រួចរាល់`)
    }
  }

  return (
    <View style={[styles.row, item.pending && styles.rowPending]}>
      <View style={styles.infoCol}>
        <Text style={[styles.title, { fontFamily: fonts.khmer }]}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { fontFamily: fonts.khmer }]}>{item.date || item.timestamp}</Text>
          <Text style={styles.metaSeparator}>•</Text>
          <Text style={[styles.metaText, { fontFamily: fonts.khmer }]}>
            {item.wordsCount || 0} ពាក្យ ({estimateDuration(item.wordsCount)})
          </Text>
          {!!item.cached && (
            <View style={styles.cacheTag}>
              <Text style={styles.cacheTagText}>Cache</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actionsGrid}>
        <View style={styles.tierRow}>
          <AccessiblePressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? s.primaryPressed : s.primary }]}
            disabled={item.pending}
            accessibilityLabel={`អាន ${item.name}`}
            onPress={() => quickPlayHistoryItem(item)}
          >
            <Play size={16} color={s.onPrimary} fill={s.onPrimary} />
            <Text style={[styles.actionBtnText, { color: s.onPrimary, fontFamily: fonts.khmer }]}>អាន</Text>
          </AccessiblePressable>

          <AccessiblePressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? '#C7D9FF' : s.surface2 }]}
            disabled={item.pending}
            accessibilityLabel={`បើក ${item.name}`}
            onPress={() => loadHistoryItem(item)}
          >
            <BookOpen size={16} color={s.onTonal} />
            <Text style={[styles.actionBtnText, { color: s.onTonal, fontFamily: fonts.khmer }]}>បើក</Text>
          </AccessiblePressable>
        </View>

        <View style={styles.tierRow}>
          <AccessiblePressable
            style={({ pressed }) => [styles.toolBtn, pressed && { backgroundColor: s.surface2 }]}
            disabled={item.pending}
            accessibilityLabel={`ចែករំលែក ${item.name}`}
            onPress={handleShare}
          >
            <Share2 size={16} color={s.onSurfaceMuted} />
          </AccessiblePressable>

          <AccessiblePressable
            style={({ pressed }) => [styles.toolBtn, pressed && { backgroundColor: s.surface2 }]}
            disabled={item.pending}
            accessibilityLabel={`ប្តូរឈ្មោះ ${item.name}`}
            onPress={() => onRename(item)}
          >
            <Edit2 size={16} color={s.onSurfaceMuted} />
          </AccessiblePressable>

          <AccessiblePressable
            style={({ pressed }) => [styles.toolBtn, pressed && { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}
            disabled={item.pending}
            accessibilityLabel={`លុប ${item.name}`}
            onPress={() => {
              triggerHaptic('medium')
              speakAccessibility(`បានលុបឯកសារ ${item.name}`)
              deleteHistoryItem(item.id)
            }}
          >
            <Trash2 size={16} color={colors.textMuted} />
          </AccessiblePressable>
        </View>
      </View>
    </View>
  )
}

const createStyles = (colors, s) =>
  StyleSheet.create({
    row: { padding: 16, gap: 14, backgroundColor: s.bg, borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
    rowPending: { opacity: 0.6 },
    infoCol: { gap: 6 },
    title: { fontSize: 20, fontWeight: '700', color: s.onSurface, lineHeight: 27 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    metaText: { fontSize: 15.5, fontWeight: '600', color: s.onSurfaceMuted },
    metaSeparator: { color: s.divider, fontWeight: '800' },
    cacheTag: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 4, backgroundColor: s.surface2 },
    cacheTagText: { fontSize: 13, fontWeight: '700', color: s.onTonal },
    actionsGrid: { gap: 10, marginTop: 4 },
    tierRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 4,
    },
    actionBtnText: { fontWeight: '700', fontSize: 16.5 },
    toolBtn: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
  })
