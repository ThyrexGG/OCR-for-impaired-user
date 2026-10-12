import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import CameraCapture from '../components/CameraCapture'
import ProcessingCard from '../components/ProcessingCard'
import OcrErrorCard from '../components/OcrErrorCard'

// Chrome-free: the camera fills all remaining space, mirroring HomeScreen.vue's
// "camera-fullscreen" workspace (8/10/10 gutter) around DocumentUploader's
// tinted `.uploader-deck` (--surface-1, 8/10 inner padding).
export default function CameraScreen() {
  const { colors } = useTheme()
  const { isProcessing, ocrError } = useOcr()
  const s = colors.surfaces

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: s.bg }]} edges={['left', 'right']}>
      <View style={styles.wrapper}>
        {isProcessing ? (
          <ProcessingCard />
        ) : ocrError ? (
          <OcrErrorCard />
        ) : (
          <View style={[styles.deck, { backgroundColor: s.surface1 }]}>
            <CameraCapture />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrapper: { flex: 1, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10 },
  deck: { flex: 1, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
})
