import { StyleSheet, Text, View } from 'react-native'
import { BookOpen, Trash2 } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import AccessiblePressable from './AccessiblePressable'
import { useTourTarget } from '../context/TourContext'

const estimateDuration = (wordsCount) => {
  if (!wordsCount) return '~30 វិនាទី'
  const minutes = Math.ceil(wordsCount / 120)
  return `~${minutes} នាទី`
}

// The web app's `.history-list-row` (UserHistory.vue): a card with the document
// name and "date • N words (~time)", then two pill actions: Open and Delete.
export default function HistoryRow({ item, tourFirst = false }) {
  const { colors, fonts, currentTheme } = useTheme()
  const { triggerHaptic, speakAccessibility } = useApp()
  const { loadHistoryItem, deleteHistoryItem } = useOcr()
  const s = colors.surfaces
  const styles = createStyles(s, currentTheme)
  // Only the first row is something the guided tour points at
  const rowTourRef = useTourTarget('history-row')
  const openTourRef = useTourTarget('history-open')
  const deleteTourRef = useTourTarget('history-delete')

  return (
    <View ref={tourFirst ? rowTourRef : undefined} collapsable={false} style={[styles.row, item.pending && styles.rowPending]}>
      <View style={styles.infoCol}>
        <Text style={[styles.title, { fontFamily: fonts.khmer }]} numberOfLines={2}>
          {item.name}
        </Text>
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

      <View style={styles.actions}>
        <AccessiblePressable
          style={[styles.actionBtn, { backgroundColor: s.primary }]}
          disabled={item.pending}
          accessibilityLabel={`បើក ${item.name}`}
          ref={tourFirst ? openTourRef : undefined}
          onPress={() => loadHistoryItem(item)}
        >
          <BookOpen size={16} color={s.onPrimary} />
          <Text style={[styles.actionText, { color: s.onPrimary, fontFamily: fonts.khmer }]}>បើក</Text>
        </AccessiblePressable>

        <AccessiblePressable
          style={[styles.actionBtn, { backgroundColor: colors.dangerSubtle }]}
          disabled={item.pending}
          ref={tourFirst ? deleteTourRef : undefined}
          accessibilityLabel={`លុប ${item.name}`}
          onPress={() => {
            triggerHaptic('medium')
            speakAccessibility(`បានលុបឯកសារ ${item.name}`)
            deleteHistoryItem(item.id)
          }}
        >
          <Trash2 size={16} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger, fontFamily: fonts.khmer }]}>លុប</Text>
        </AccessiblePressable>
      </View>
    </View>
  )
}

const createStyles = (s, theme) =>
  StyleSheet.create({
    row: {
      padding: 16,
      gap: 14,
      backgroundColor: theme === 'dark' ? s.surface1 : '#FFFFFF',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: s.divider,
    },
    rowPending: { opacity: 0.6 },
    infoCol: { gap: 6 },
    title: { fontSize: 19, fontWeight: '700', color: s.onSurface, lineHeight: 27 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    metaText: { fontSize: 15, fontWeight: '600', color: s.onSurfaceMuted },
    metaSeparator: { color: s.divider, fontWeight: '800' },
    cacheTag: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, backgroundColor: s.surface2 },
    cacheTagText: { fontSize: 13, fontWeight: '700', color: s.onTonal },
    actions: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 23 },
    actionText: { fontWeight: '700', fontSize: 16 },
  })
