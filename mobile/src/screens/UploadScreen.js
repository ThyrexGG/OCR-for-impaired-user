import { ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import UploadDropzone from '../components/UploadDropzone'
import DocumentPreview from '../components/DocumentPreview'
import SampleDocsGrid from '../components/SampleDocsGrid'
import ProcessingCard from '../components/ProcessingCard'
import OcrErrorCard from '../components/OcrErrorCard'

// Ports HomeScreen.vue's activeMode==='upload' branch at phone width: the
// workspace's 20px gutter, then DocumentUploader's tinted `.uploader-deck`
// (--surface-1) holding the dropzone + sample list — or the shared
// processing / error card, or a picked file's preview. A camera photo is
// never shown here (it shares selectedFile), so Upload always offers picking.
export default function UploadScreen() {
  const { colors } = useTheme()
  const { isProcessing, selectedFile, ocrError } = useOcr()
  const s = colors.surfaces

  if (isProcessing || ocrError) {
    return (
      <ScrollView style={{ backgroundColor: s.bg }} contentContainerStyle={styles.page}>
        {isProcessing ? <ProcessingCard /> : <OcrErrorCard />}
      </ScrollView>
    )
  }

  return (
    <ScrollView style={{ backgroundColor: s.bg }} contentContainerStyle={styles.page}>
      <View style={[styles.deck, { backgroundColor: s.surface1 }]}>
        {selectedFile?.source === 'upload' ? (
          <DocumentPreview />
        ) : (
          <>
            <UploadDropzone />
            <SampleDocsGrid />
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 44 },
  deck: { borderRadius: 4, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 28, gap: 16 },
})
