import { StyleSheet, Text, View } from 'react-native'
import { AlertCircle, Camera, RefreshCw, Upload } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import { SCAN_ERRORS } from '../services/scanErrors'
import NeoButton from './NeoButton'

// Shown in place of whichever tab triggered a failed scan. It says what went wrong in a few words and what
// to do next; the lighting tips only appear when they can help (no text found), and "Try again" re-sends
// the same photo when the problem was the connection or the service, so the user doesn't have to reshoot.
export default function OcrErrorCard() {
  const { colors, fonts } = useTheme()
  const { ocrError, selectedFile, triggerOcr, handleScanAgain } = useOcr()
  const styles = createStyles(colors)
  const error = SCAN_ERRORS[ocrError] || SCAN_ERRORS.unknown
  const canRetry = error.retry && !!selectedFile?.uri
  const fromCamera = selectedFile?.source === 'camera'
  const NewIcon = fromCamera ? Camera : Upload
  const newLabel = fromCamera ? 'ថតរូបថ្មី' : 'ជ្រើសឯកសារផ្សេង'

  return (
    <View style={styles.card} accessibilityLiveRegion="assertive">
      <View style={styles.glowIcon}>
        <AlertCircle size={40} color="#FFFFFF" />
      </View>
      <Text style={[styles.title, { fontFamily: fonts.khmer }]} accessibilityRole="header">{error.title}</Text>
      <Text style={[styles.desc, { fontFamily: fonts.khmer }]}>{error.say}</Text>

      {!!error.tips && (
        <View style={styles.tipsBox}>
          {error.tips.map((tip, idx) => (
            <View key={idx} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={[styles.tipText, { fontFamily: fonts.khmer }]}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {canRetry && (
        <NeoButton
          style={styles.retryWrap}
          bg="#4466F6"
          borderColor="#0F172A"
          shadowColor="#0F172A"
          contentStyle={styles.retryBtn}
          accessibilityLabel="ព្យាយាមម្តងទៀត"
          onPress={triggerOcr}
        >
          <RefreshCw size={24} color="#FFFFFF" />
          <Text style={[styles.retryText, { fontFamily: fonts.khmer }]}>ព្យាយាមម្តងទៀត</Text>
        </NeoButton>
      )}

      <NeoButton
        style={styles.retryWrap}
        bg={canRetry ? '#FFFFFF' : '#4466F6'}
        borderColor="#0F172A"
        shadowColor={canRetry ? '#4466F6' : '#0F172A'}
        contentStyle={styles.retryBtn}
        accessibilityLabel={newLabel}
        onPress={handleScanAgain}
      >
        <NewIcon size={24} color={canRetry ? '#0F172A' : '#FFFFFF'} />
        <Text style={[styles.retryText, { fontFamily: fonts.khmer }, canRetry && { color: '#0F172A' }]}>{newLabel}</Text>
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
    tipRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingLeft: 6 },
    tipBullet: { color: colors.textSecondary, fontWeight: '800', lineHeight: 26 },
    tipText: { flex: 1, fontSize: 16, color: colors.textSecondary, lineHeight: 26 },
    retryWrap: { marginTop: 8, marginLeft: 4 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 60, paddingVertical: 12, paddingHorizontal: 32 },
    retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
  })
