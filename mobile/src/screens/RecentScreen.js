import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Clock, History, Trash2 } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import HistoryRow from '../components/HistoryRow'
import RenameModal from '../components/RenameModal'
import AccessiblePressable from '../components/AccessiblePressable'

// Ports UserHistory.vue's "recent-reads-shelf" at phone width: 20px workspace
// gutter, a --surface-1 shelf with its header ruled off by --divider, and a
// 14px-gapped list of --bg rows.
export default function RecentScreen() {
  const { colors, fonts } = useTheme()
  const { triggerHaptic, speakAccessibility } = useApp()
  const { historyList, clearHistory, renameHistoryItem } = useOcr()
  const [renameTarget, setRenameTarget] = useState(null)
  const s = colors.surfaces
  const styles = createStyles(colors, s)

  const handleClearAll = () => {
    Alert.alert('សម្អាតទាំងអស់', 'តើអ្នកពិតជាចង់សម្អាតប្រវត្តិអានទាំងអស់មែនទេ?', [
      { text: 'បោះបង់', style: 'cancel' },
      {
        text: 'សម្អាត',
        style: 'destructive',
        onPress: () => {
          triggerHaptic('warning')
          speakAccessibility('បានសម្អាតប្រវត្តិអានទាំងអស់រួចរាល់')
          clearHistory()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: s.bg }]} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.shelf}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <History size={20} color={colors.accentText} />
              </View>
              <View style={styles.titles}>
                <Text style={[styles.title, { fontFamily: fonts.khmer }]}>ឯកសារអានថ្មីៗ</Text>
                <Text style={[styles.subtitle, { fontFamily: fonts.khmer }]}>{historyList.length} ឯកសារបានកត់ត្រាទុក</Text>
              </View>
            </View>
            {historyList.length > 0 && (
              <AccessiblePressable style={styles.clearBtn} accessibilityLabel="សម្អាតទាំងអស់" onPress={handleClearAll}>
                <Trash2 size={15} color={colors.textSecondary} />
                <Text style={[styles.clearBtnText, { fontFamily: fonts.khmer }]}>សម្អាតទាំងអស់</Text>
              </AccessiblePressable>
            )}
          </View>

          <View style={styles.body}>
            {historyList.length === 0 ? (
              <View style={styles.emptyState}>
                <Clock size={44} color={colors.accent} />
                <Text style={[styles.emptyTitle, { fontFamily: fonts.khmer }]}>មិនទាន់មានប្រវត្តិអាននៅឡើយទេ</Text>
                <Text style={[styles.emptyDesc, { fontFamily: fonts.khmer }]}>
                  រាល់ឯកសារដែលអ្នកស្កេន ឬជ្រើសរើស នឹងត្រូវបានកត់ត្រាទុកនៅទីនេះដោយស្វ័យប្រវត្តិ ដើម្បីងាយស្រួលស្តាប់ឡើងវិញគ្រប់ពេលវេលា។
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {historyList.map((item) => (
                  <HistoryRow key={String(item.id)} item={item} onRename={setRenameTarget} />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <RenameModal
        visible={!!renameTarget}
        initialName={renameTarget?.name}
        onCancel={() => setRenameTarget(null)}
        onSave={(newName) => {
          renameHistoryItem(renameTarget.id, newName)
          setRenameTarget(null)
        }}
      />
    </SafeAreaView>
  )
}

const createStyles = (colors, s) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 44 },
    shelf: { backgroundColor: s.surface1, borderRadius: 4, overflow: 'hidden' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 18,
      gap: 14,
      backgroundColor: s.surface1,
      borderBottomWidth: 1,
      borderBottomColor: s.divider,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
    iconCircle: {
      width: 42,
      height: 42,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      ...colors.shadows.glow,
    },
    titles: { flexShrink: 1 },
    title: { fontSize: 21, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 42,
      paddingVertical: 6,
      paddingHorizontal: 14,
      maxWidth: 140,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      borderRadius: 4,
    },
    clearBtnText: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
    body: { paddingVertical: 16, paddingHorizontal: 14 },
    list: { gap: 14 },
    emptyState: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 21, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    emptyDesc: { fontSize: 16.5, color: colors.textMuted, textAlign: 'center', lineHeight: 26, maxWidth: 440 },
  })
