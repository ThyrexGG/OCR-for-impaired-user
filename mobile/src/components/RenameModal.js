import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from './AccessiblePressable'

// Replaces window.prompt() (UserHistory.vue's handleRename), which has no RN equivalent.
export default function RenameModal({ visible, initialName, onCancel, onSave }) {
  const { colors, fonts } = useTheme()
  const [name, setName] = useState(initialName || '')
  const styles = createStyles(colors)

  useEffect(() => {
    if (visible) setName(initialName || '')
  }, [visible, initialName])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={[styles.title, { fontFamily: fonts.khmer }]}>ប្តូរឈ្មោះឯកសារ (Rename document)</Text>
          <TextInput
            style={[styles.input, { fontFamily: fonts.khmer }]}
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            placeholder="ឈ្មោះឯកសារ"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.actions}>
            <AccessiblePressable style={styles.cancelBtn} accessibilityLabel="បោះបង់" onPress={onCancel}>
              <Text style={[styles.cancelText, { fontFamily: fonts.khmer }]}>បោះបង់</Text>
            </AccessiblePressable>
            <AccessiblePressable
              style={styles.saveBtn}
              accessibilityLabel="រក្សាទុក"
              hapticIntensity="light"
              onPress={() => name.trim() && onSave(name.trim())}
            >
              <Text style={[styles.saveText, { fontFamily: fonts.khmer }]}>រក្សាទុក</Text>
            </AccessiblePressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.bgSurface,
      borderRadius: colors.radii.lg,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      padding: 20,
      gap: 16,
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      borderRadius: colors.radii.sm,
      color: colors.textPrimary,
      fontSize: 15,
    },
    actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
    cancelBtn: { minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radii.sm },
    cancelText: { color: colors.textSecondary, fontWeight: '700' },
    saveBtn: { minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: colors.radii.sm },
    saveText: { color: colors.accentText, fontWeight: '700' },
  })
