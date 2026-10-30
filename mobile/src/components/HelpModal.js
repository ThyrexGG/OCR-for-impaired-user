import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check, HelpCircle, X } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import AccessiblePressable from './AccessiblePressable'
import { useTour } from '../context/TourContext'

const STEPS = [
  {
    heading: 'តម្រង់កាមេរ៉ាទៅកាន់ឯកសារ',
    desc: 'កាន់ទូរស័ព្ទរបស់អ្នកនៅពីលើក្រដាស ឬសៀវភៅដែលចង់អាន។ ស៊ុមក្រហមនឹងព័ទ្ធជុំវិញឯកសារ (Point your camera at a document; a red outline appears around it).',
  },
  {
    heading: 'កាន់ទូរស័ព្ទឱ្យនឹង',
    desc: 'រក្សាទីតាំងឱ្យនឹងនរ និងប្រាកដថាមានពន្លឺគ្រប់គ្រាន់ (Hold the document steady with good light).',
  },
  {
    heading: 'ចុចប៊ូតុងថតរូបភាព',
    desc: 'ពេលមានការញ័រស្រាល ចុចប៊ូតុងថតមូលនៅខាងក្រោម ឬចុចប៊ូតុងសំឡេងនៅចំហៀងទូរស័ព្ទ។ រូបថតនឹងកាត់យកតែឯកសារ (When you feel a light buzz, press the round capture button or a volume button on the side of the phone; the photo is cropped to the page).',
  },
  {
    heading: 'រង់ចាំការស្រង់អត្ថបទ',
    desc: 'ពេលកំពុងស្រង់អត្ថបទ អ្នកនឹងឮសំឡេងប៊ីបតិចៗ (While the text is being extracted you hear soft beeps).',
  },
  {
    heading: 'ស្តាប់ការអាន',
    desc: 'កម្មវិធីនឹងចាប់ផ្តើមអានឱ្យអ្នកស្តាប់ដោយស្វ័យប្រវត្តិ។ ចុចប៊ូតុងធំ ដើម្បីផ្អាក ឬបន្តការអាន (The app starts reading aloud by itself; tap the big button to pause or continue).',
  },
]

export default function HelpModal() {
  const { colors, fonts } = useTheme()
  const { isHelpOpen, closeHelp } = useApp()
  const { startTour } = useTour()
  const styles = createStyles(colors)

  return (
    <Modal visible={isHelpOpen} transparent animationType="fade" onRequestClose={closeHelp}>
      <View style={styles.backdrop}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={closeHelp} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <View style={styles.iconBox}>
                <HelpCircle size={22} color={colors.accentText} />
              </View>
              <Text style={[styles.title, { fontFamily: fonts.khmer }]}>របៀបប្រើប្រាស់ (How to Use)</Text>
            </View>
            <AccessiblePressable style={styles.closeBtn} accessibilityLabel="បិទផ្ទាំងការណែនាំ" onPress={closeHelp}>
              <X size={22} color={colors.textSecondary} />
            </AccessiblePressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 14 }}>
            {STEPS.map((step, i) => (
              <View key={step.heading} style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{i + 1}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepHeading, { fontFamily: fonts.khmer }]}>{step.heading}</Text>
                  <Text style={[styles.stepDesc, { fontFamily: fonts.khmer }]}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <AccessiblePressable
              style={styles.tourBtn}
              accessibilityLabel="មើលការណែនាំជាជំហានៗ (Guided tour)"
              hapticIntensity="light"
              onPress={() => {
                closeHelp()
                setTimeout(startTour, 300)
              }}
            >
              <Text style={[styles.tourText, { fontFamily: fonts.khmer }]}>ការណែនាំជាជំហានៗ (Guided tour)</Text>
            </AccessiblePressable>
            <AccessiblePressable style={styles.gotItBtn} accessibilityLabel="យល់ព្រម (Got it)" hapticIntensity="light" onPress={closeHelp}>
              <Check size={18} color={colors.accentText} />
              <Text style={[styles.gotItText, { fontFamily: fonts.khmer }]}>យល់ព្រម (Got it)</Text>
            </AccessiblePressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    card: {
      width: '100%',
      maxWidth: 580,
      maxHeight: '88%',
      backgroundColor: colors.bgSurface,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      borderRadius: colors.radii.xl,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 18,
      borderBottomWidth: 2,
      borderBottomColor: colors.borderSubtle,
    },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 38, height: 38, borderRadius: colors.radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
    title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    closeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: colors.radii.sm },
    body: { padding: 18 },
    stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 12, backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: colors.radii.md },
    stepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    stepBadgeText: { color: colors.accentText, fontWeight: '800', fontSize: 15 },
    stepContent: { flex: 1, gap: 2 },
    stepHeading: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    stepDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    footer: { padding: 18, borderTopWidth: 1.5, borderTopColor: colors.borderSubtle, gap: 10 },
    tourBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: colors.radii.md, borderWidth: 1.5, borderColor: colors.borderMedium },
    tourText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
    gotItBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: colors.radii.md, paddingHorizontal: 20 },
    gotItText: { color: colors.accentText, fontWeight: '700', fontSize: 14 },
  })
