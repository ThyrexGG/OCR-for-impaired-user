import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeContext'
import OcrTextView from '../components/OcrTextView'

// Ports HomeScreen.vue's reader-mode-container. On the web the whole reader
// (doc card, action stack, reading card, and the TtsPanel deck last) is one
// scrolling column, so OcrTextView owns the ScrollView and renders the deck.
export default function ReaderScreen() {
  const { colors } = useTheme()

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bgPage }]} edges={['left', 'right']}>
      <OcrTextView />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
