import { StyleSheet, Text, View } from 'react-native'
import { ArrowRight, Sparkles } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import AccessiblePressable from './AccessiblePressable'
import { TP } from '../services/talkPhrases'
import { useTourTarget } from '../context/TourContext'

// Ports DocumentUploader.vue's "Sample Documents" section — SURFACES.md 8/11:
// an unboxed list (no card border/background), a solid navy category chip
// above each large --heading title, --primary chevron, --divider hairlines.
export default function SampleDocsGrid() {
  const { colors, fonts } = useTheme()
  const { sampleLibrary, loadSample } = useOcr()
  const s = colors.surfaces
  const styles = createStyles(s)
  const tourRef = useTourTarget('samples')

  return (
    <View ref={tourRef} collapsable={false} style={styles.section} accessibilityLabel="សាកល្បងជាមួយឯកសារគំរូ">
      <View style={styles.header}>
        <Sparkles size={24} color={s.heading} />
        <Text style={[styles.title, { fontFamily: fonts.khmer }]}>សាកល្បងជាមួយឯកសារគំរូ៖</Text>
      </View>
      <View style={styles.list}>
        {sampleLibrary.map((sample, idx) => (
          <View key={sample.id}>
            {idx > 0 && <View style={styles.divider} />}
            <AccessiblePressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: s.surface2 }]}
              accessibilityLabel={TP['sampleOpen_' + sample.id]?.km || `${sample.category} ${sample.title}`}
              onPress={() => loadSample(sample)}
            >
              <View style={styles.rowText}>
                <View style={styles.categoryChip}>
                  <Text style={[styles.categoryChipText, { fontFamily: fonts.khmer }]}>{sample.category}</Text>
                </View>
                <Text style={[styles.rowTitle, { fontFamily: fonts.khmer }]}>{sample.title}</Text>
              </View>
              <ArrowRight size={26} color={s.primary} />
            </AccessiblePressable>
          </View>
        ))}
      </View>
    </View>
  )
}

const createStyles = (s) =>
  StyleSheet.create({
    section: { gap: 8, marginTop: 4, paddingTop: 4, paddingBottom: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    title: { fontSize: 21, fontWeight: '800', color: s.heading, letterSpacing: -0.2 },
    list: { width: '100%' },
    divider: { height: 1, backgroundColor: s.divider, width: '100%' },
    row: {
      width: '100%',
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
      backgroundColor: 'transparent',
      borderRadius: 16,
    },
    rowText: { flex: 1, gap: 6, alignItems: 'flex-start' },
    categoryChip: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: s.navy },
    categoryChipText: { fontSize: 16, fontWeight: '800', color: s.onNavy, letterSpacing: 0.5 },
    rowTitle: { fontSize: 26, fontWeight: '800', color: s.heading, lineHeight: 35 },
  })
