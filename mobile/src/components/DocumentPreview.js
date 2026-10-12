import { Image, StyleSheet, Text, View } from 'react-native'
import { FileText, RefreshCw, Sparkles } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import NeoButton from './NeoButton'

/**
 * Ports DocumentUploader.vue's "preview-assistant-view" (View C) at ≤640px:
 * media box, then a single column of Re-take (white, blue offset shadow)
 * and the hero "Extract Text" button (blue, ink offset shadow). Only ever
 * reached from the Upload tab — the Camera tab's captureAndScan() triggers
 * OCR immediately, so a captured photo never pauses here.
 */
export default function DocumentPreview() {
  const { colors, fonts, currentTheme } = useTheme()
  const { previewUri, selectedFile, isProcessing, clearFile, triggerOcr } = useOcr()
  const styles = createStyles(colors)
  const dark = currentTheme === 'dark'

  return (
    <View style={styles.container}>
      <View style={styles.mediaBox}>
        {previewUri === 'pdf' ? (
          <View style={styles.pdfCard}>
            <FileText size={60} color={colors.accent} />
            <Text style={[styles.pdfName, { fontFamily: fonts.khmer }]}>{selectedFile?.name}</Text>
          </View>
        ) : (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" accessibilityLabel="រូបភាពដែលបានផ្ទុក" />
        )}
      </View>

      <View style={styles.actionRow}>
        <NeoButton
          offsetX={-3}
          offsetY={3}
          bg={dark ? '#1E293B' : '#FFFFFF'}
          borderColor={dark ? '#94A3B8' : '#0F172A'}
          shadowColor={dark ? '#60A5FA' : '#1D4ED8'}
          disabled={isProcessing}
          contentStyle={styles.retakeButton}
          accessibilityLabel="ថតឡើងវិញ"
          onPress={clearFile}
        >
          <RefreshCw size={18} color={dark ? '#FFFFFF' : '#0F172A'} />
          <Text style={[styles.retakeText, { color: dark ? '#FFFFFF' : '#0F172A', fontFamily: fonts.khmer }]}>ថតឡើងវិញ</Text>
        </NeoButton>

        <NeoButton
          bg={dark ? '#3B82F6' : '#1D4ED8'}
          borderColor={dark ? '#FFFFFF' : '#0F172A'}
          shadowColor={dark ? '#FFFFFF' : '#0F172A'}
          disabled={isProcessing}
          contentStyle={styles.scanButton}
          hapticIntensity="medium"
          accessibilityLabel="ស្កេន និងស្រង់អត្ថបទ"
          onPress={triggerOcr}
        >
          <Sparkles size={24} color={dark ? '#0F172A' : '#FFFFFF'} />
          <Text style={[styles.scanButtonText, { color: dark ? '#0F172A' : '#FFFFFF', fontFamily: fonts.khmer }]}>
            {isProcessing ? 'កំពុងស្រង់អត្ថបទ...' : 'ស្កេន និងស្រង់អត្ថបទ'}
          </Text>
        </NeoButton>
      </View>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { gap: 16, paddingTop: 6, paddingHorizontal: 2 },
    mediaBox: {
      width: '100%',
      minHeight: 240,
      maxHeight: 360,
      height: 300,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: colors.bgSurfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.borderMedium,
    },
    previewImage: { width: '100%', height: '100%' },
    pdfCard: { alignItems: 'center', gap: 12, padding: 24 },
    pdfName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    actionRow: { gap: 14, paddingLeft: 4 },
    retakeButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
    retakeText: { fontWeight: '700', fontSize: 17.5 },
    scanButton: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 20 },
    scanButtonText: { fontWeight: '800', fontSize: 21 },
  })
