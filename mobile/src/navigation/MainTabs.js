import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Camera, Upload, BookOpen, History } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from '../components/AccessiblePressable'
import AppHeader from '../components/AppHeader'
import SettingsModal from '../components/SettingsModal'
import HelpModal from '../components/HelpModal'
import CameraScreen from '../screens/CameraScreen'
import UploadScreen from '../screens/UploadScreen'
import ReaderScreen from '../screens/ReaderScreen'
import RecentScreen from '../screens/RecentScreen'

const Tab = createBottomTabNavigator()

const TAB_ICONS = { Camera, Upload, Reader: BookOpen, Recent: History }

// Mirrors App.vue's shell: a persistent header above the routed content,
// bottom-nav-bar as real tabs (Camera / Upload / Reader / Recent), and the
// Settings/Help modals mounted once here so any tab can open them.
export default function MainTabs() {
  const { colors } = useTheme()

  return (
    <View style={styles.flex}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bgSurface }}>
        <AppHeader />
      </SafeAreaView>
      <View style={styles.flex}>
        <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <WebTabBar {...props} />}>
          <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarLabel: 'កាមេរ៉ា', tabBarAccessibilityLabel: 'ម៉ូដកាមេរ៉ា (Camera)' }} />
          <Tab.Screen name="Upload" component={UploadScreen} options={{ tabBarLabel: 'ផ្ទុកឯកសារ', tabBarAccessibilityLabel: 'ម៉ូដផ្ទុកឯកសារ (Upload)' }} />
          <Tab.Screen name="Reader" component={ReaderScreen} options={{ tabBarLabel: 'អានឯកសារ', tabBarAccessibilityLabel: 'ម៉ូដអានឯកសារ (Document Reader)' }} />
          <Tab.Screen name="Recent" component={RecentScreen} options={{ tabBarLabel: 'ប្រវត្តិអាន', tabBarAccessibilityLabel: 'ម៉ូដប្រវត្តិអាន (Recent Reads)' }} />
        </Tab.Navigator>
      </View>
      <SettingsModal />
      <HelpModal />
    </View>
  )
}

// Ports `.bottom-nav-bar` at its phone breakpoint: 3px top rule, 4 equal
// 58px tabs, and the active tab boxed (tonal fill + 2px primary border)
// rather than just tinted. Its bottom padding grows with the gesture-nav
// inset so the tabs never sit inside Android's swipe zone.
function WebTabBar({ state, descriptors, navigation }) {
  const { fonts, colors } = useTheme()
  const insets = useSafeAreaInsets()
  const s = colors.surfaces
  const p = { bg: s.bg, topBorder: s.onSurface, activeBg: s.surface2, active: s.primary, inactive: s.onSurfaceMuted }

  return (
    <View style={[tabStyles.bar, { backgroundColor: p.bg, borderTopColor: p.topBorder, paddingBottom: 8 + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const focused = state.index === index
        const Icon = TAB_ICONS[route.name]
        const color = focused ? p.active : p.inactive

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
        }

        return (
          <AccessiblePressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={[tabStyles.tab, focused && { backgroundColor: p.activeBg, borderColor: p.active }]}
          >
            <Icon size={focused ? 27 : 24} color={color} />
            <Text style={[tabStyles.label, { color, fontFamily: fonts.khmer, fontWeight: focused ? '800' : '700' }]} numberOfLines={1}>
              {options.tabBarLabel}
            </Text>
          </AccessiblePressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 } })

const tabStyles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 6, paddingTop: 8, paddingHorizontal: 10, borderTopWidth: 3 },
  tab: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 4,
  },
  label: { fontSize: 12, lineHeight: 16 },
})
