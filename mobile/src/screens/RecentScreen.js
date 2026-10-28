import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Upload } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import HistoryRow from '../components/HistoryRow'
import AccessiblePressable from '../components/AccessiblePressable'
import { navigateToUpload } from '../navigation/navigationRef'
import useScreenIntro from '../utils/useScreenIntro'
import { TP } from '../services/talkPhrases'

// The web app's recent-reads page (UserHistory.vue): a list of document cards
// and a full-width red "clear all" button; a centered empty state otherwise.
export default function RecentScreen() {
  const { colors, fonts } = useTheme()
  const { triggerHaptic, speakAccessibility } = useApp()
  const { historyList, clearHistory } = useOcr()
  const s = colors.surfaces
  const styles = createStyles(s)
  useScreenIntro(() => (historyList.length === 0 ? TP.screenRecentEmpty.km : [TP.screenRecent.km, `${historyList.length} ${TP.documentsUnit.km}`]))

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
      <ScrollView contentContainerStyle={[styles.page, historyList.length === 0 && styles.pageEmpty]}>
        {historyList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { fontFamily: fonts.khmerBold }]}>មិនទាន់មានប្រវត្តិអាននៅឡើយទេ</Text>
            <Text style={[styles.emptyDesc, { fontFamily: fonts.khmer }]}>
              រាល់ឯកសារដែលអ្នកស្កេន ឬជ្រើសរើស នឹងត្រូវបានកត់ត្រាទុកនៅទីនេះដោយស្វ័យប្រវត្តិ ដើម្បីងាយស្រួលស្តាប់ឡើងវិញគ្រប់ពេលវេលា។
            </Text>
            <AccessiblePressable style={styles.uploadBtn} accessibilityLabel="ជ្រើសរើសឯកសារ" onPress={navigateToUpload}>
              <Upload size={20} color="#FFFFFF" />
              <Text style={[styles.uploadBtnText, { fontFamily: fonts.khmerBold }]}>ជ្រើសរើសឯកសារ</Text>
            </AccessiblePressable>
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {historyList.map((item, i) => (
                <HistoryRow key={String(item.id)} item={item} tourFirst={i === 0} />
              ))}
            </View>
            <AccessiblePressable style={styles.clearBtn} accessibilityLabel="សម្អាតទាំងអស់" onPress={handleClearAll}>
              <Text style={[styles.clearBtnText, { fontFamily: fonts.khmerBold }]}>សម្អាតទាំងអស់</Text>
            </AccessiblePressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (s) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { padding: 16, paddingBottom: 32, gap: 18 },
    pageEmpty: { flexGrow: 1, justifyContent: 'center' },
    list: { gap: 14 },
    clearBtn: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#DC2626' },
    clearBtnText: { color: '#FFFFFF', fontSize: 16 },
    emptyState: { alignItems: 'center', gap: 12, paddingHorizontal: 12 },
    emptyTitle: { fontSize: 21, color: s.onSurface, textAlign: 'center' },
    emptyDesc: { fontSize: 16, color: s.onSurfaceMuted, textAlign: 'center', lineHeight: 26, maxWidth: 420 },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: s.primary, marginTop: 6 },
    uploadBtnText: { color: '#FFFFFF', fontSize: 17 },
  })
