import { StyleSheet, Text, View } from 'react-native'
import { AlertCircle, Camera } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import NeoButton from './NeoButton'

const TIPS = [
  'សូមថតនៅកន្លែងដែលមានពន្លឺគ្រប់គ្រាន់។',
  'កាន់កាមេរ៉ាឱ្យនឹងនរ កុំឱ្យរំញ័រ។',
  'រំកិលកាមេរ៉ាឱ្យកៀកនឹងអត្ថបទបន្ថែមទៀត។',
  'ថតរូបភាពសន្លឹកឯកសារម្តងទៀត។',
]

// Ported from HomeScreen.vue's `.ocr-error-card` (≤640px sizing) — shown in
// place of whichever tab triggered a failed OCR attempt, with the same tips
// and the btn-primary "Scan Again" recovery action as the web app.
export default function OcrErrorCard() {
  const { colors, fonts } = useTheme()
  const { ocrError, handleScanAgain } = useOcr()
  const styles = createStyles(colors)

  return (
    <View style={styles.card} accessibilityLiveRegion="assertive">
      <View style={styles.glowIcon}>
        <AlertCircle size={40} color="#FFFFFF" />
      </View>
      <Text style={[styles.title, { fontFamily: fonts.khmer }]}>មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ</Text>
      {!!ocrError && <Text style={[styles.desc, { fontFamily: fonts.khmer }]}>{ocrError}</Text>}

      <View style={styles.tipsBox}>
        <Text style={[styles.tipsHeading, { fontFamily: fonts.khmer }]}>វិធីដោះស្រាយដែលត្រូវបានណែនាំ៖</Text>
        {TIPS.map((tip, idx) => (
          <View key={idx} style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={[styles.tipText, { fontFamily: fonts.khmer }]}>{tip}</Text>
          </View>
        ))}
      </View>

      <NeoButton
        style={styles.retryWrap}
        bg="#4466F6"
        borderColor="#0F172A"
        shadowColor="#0F172A"
        contentStyle={styles.retryBtn}
        accessibilityLabel="ស្កេនម្តងទៀត"
        onPress={handleScanAgain}
      >
        <Camera size={24} color="#FFFFFF" />
        <Text style={[styles.retryText, { fontFamily: fonts.khmer }]}>ស្កេនម្តងទៀត</Text>
      </NeoButton>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 20,
      gap: 18,
      marginVertical: 10,
      borderWidth: 2,
      borderColor: colors.danger,
      borderRadius: 16,
      backgroundColor: colors.surfaces.surface1,
    },
    glowIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
    title: { fontSize: 24, fontWeight: '800', color: colors.danger, textAlign: 'center', lineHeight: 34 },
    desc: { fontSize: 18, color: colors.textPrimary, textAlign: 'center', lineHeight: 29 },
    tipsBox: {
      width: '100%',
      gap: 6,
      paddingVertical: 18,
      paddingHorizontal: 20,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      borderRadius: 16,
    },
    tipsHeading: { fontSize: 17.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    tipRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingLeft: 6 },
    tipBullet: { color: colors.textSecondary, fontWeight: '800', lineHeight: 26 },
    tipText: { flex: 1, fontSize: 16, color: colors.textSecondary, lineHeight: 26 },
    retryWrap: { marginTop: 8, marginLeft: 4 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 60, paddingVertical: 12, paddingHorizontal: 32 },
    retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
  })
