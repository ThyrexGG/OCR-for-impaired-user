import { StyleSheet, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Upload } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import NeoButton from './NeoButton'
import { useTourTarget } from '../context/TourContext'

/**
 * Ports DocumentUploader.vue's "tactile-dropzone" (View B) — SURFACES.md 8's
 * "tinted zone, solid button, no border" redesign: a borderless tinted
 * panel (not the old dashed-border box) with an explicit "ជ្រើសរើសឯកសារ"
 * button, since drag-and-drop doesn't exist on mobile anyway.
 */
export default function UploadDropzone() {
  const { colors, fonts } = useTheme()
  const { setFile } = useOcr()
  const s = colors.surfaces
  const styles = createStyles(s)
  const tourRef = useTourTarget('upload-dropzone')

  const handlePress = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType })
  }

  return (
    <View ref={tourRef} collapsable={false} style={styles.dropzone}>
      <View style={styles.iconCircle}>
        <Upload size={26} color={s.primary} />
      </View>
      <Text style={[styles.title, { fontFamily: fonts.khmer }]}>ចុចទីនេះដើម្បីជ្រើសឯកសារ ឬអូសទម្លាក់</Text>
      <Text style={[styles.desc, { fontFamily: fonts.khmer }]}>គាំទ្ររូបភាព (JPG, PNG, WEBP) និងឯកសារ PDF</Text>

      <NeoButton
        bg="#4466F6"
        contentStyle={styles.chooseBtn}
        accessibilityLabel="ជ្រើសរើសឯកសាររូបភាព ឬ PDF ដើម្បីស្កេន"
        onPress={handlePress}
      >
        <Upload size={20} color="#FFFFFF" />
        <Text style={[styles.chooseBtnText, { fontFamily: fonts.khmer }]}>ជ្រើសរើសឯកសារ</Text>
      </NeoButton>

      <Text style={[styles.helperText, { fontFamily: fonts.khmer }]}>ឯកសារអក្សរខ្មែរ និងអង់គ្លេសគ្រប់ប្រភេទ</Text>
    </View>
  )
}

// `.tactile-dropzone` sits on --bg inside the upload deck, icon circle on
// --surface-2 in --primary, title --on-surface, desc/helper --on-surface-muted.
const createStyles = (s) =>
  StyleSheet.create({
    dropzone: {
      minHeight: 170,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 14,
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: s.surface2,
    },
    title: { fontSize: 21, fontWeight: '700', color: s.onSurface, textAlign: 'center', marginTop: 2, lineHeight: 30 },
    desc: { fontSize: 16, color: s.onSurfaceMuted, textAlign: 'center' },
    chooseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      paddingHorizontal: 26,
      marginTop: 10,
    },
    chooseBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 19 },
    helperText: { fontSize: 16, color: s.onSurfaceMuted, fontWeight: '500', marginTop: 6 },
  })
