import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Camera, Upload, History } from 'lucide-react-native'
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

// The reader is a full-screen page (own top bar + player bar, like the web's
// reader mode), so it is a route but not one of the bottom tabs.
const TAB_ICONS = { Camera, Upload, Recent: History }

function ShellHeader() {
  const { colors, currentTheme } = useTheme()
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: currentTheme === 'dark' ? colors.surfaces.surface1 : '#FFFFFF' }}>
      <AppHeader />
    </SafeAreaView>
  )
}

// Mirrors App.vue's shell: a header above the routed content, a 3-tab bottom nav
// (Camera / Upload / Recent) and the Settings/Help modals mounted once here.
export default function MainTabs() {
  return (
    <View style={styles.flex}>
      <Tab.Navigator
        backBehavior="history"
        screenOptions={{ headerShown: true, header: () => <ShellHeader /> }}
        tabBar={(props) => <PillTabBar {...props} />}
      >
        <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarLabel: 'កាមេរ៉ា', tabBarAccessibilityLabel: 'ម៉ូដកាមេរ៉ា (Camera)' }} />
        <Tab.Screen name="Upload" component={UploadScreen} options={{ tabBarLabel: 'ផ្ទុកឯកសារ', tabBarAccessibilityLabel: 'ម៉ូដផ្ទុកឯកសារ (Upload)' }} />
        <Tab.Screen name="Reader" component={ReaderScreen} options={{ headerShown: false, tabBarAccessibilityLabel: 'ម៉ូដអានឯកសារ (Document Reader)' }} />
        <Tab.Screen name="Recent" component={RecentScreen} options={{ tabBarLabel: 'ប្រវត្តិអាន', tabBarAccessibilityLabel: 'ម៉ូដប្រវត្តិអាន (Recent Reads)' }} />
      </Tab.Navigator>
      <SettingsModal />
      <HelpModal />
    </View>
  )
}

// The web's `.bottom-nav-bar`: icon + label per tab, the active tab gets a soft
// pill behind its icon. Hidden on the reader, which brings its own bottom bar.
function PillTabBar({ state, descriptors, navigation }) {
  const { fonts, colors, currentTheme } = useTheme()
  const insets = useSafeAreaInsets()
  const s = colors.surfaces

  if (state.routes[state.index].name === 'Reader') return null

  return (
    <View
      style={[
        tabStyles.bar,
        {
          backgroundColor: currentTheme === 'dark' ? s.surface1 : '#FFFFFF',
          borderTopColor: s.divider,
          paddingBottom: 8 + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const Icon = TAB_ICONS[route.name]
        if (!Icon) return null
        const { options } = descriptors[route.key]
        const focused = state.index === index
        const color = focused ? s.primary : s.onSurfaceMuted

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
            style={tabStyles.tab}
          >
            <View style={[tabStyles.iconPill, focused && { backgroundColor: currentTheme === 'dark' ? s.surface2 : '#E8ECF4' }]}>
              <Icon size={24} color={color} />
            </View>
            <Text style={[tabStyles.label, { color, fontFamily: fonts.khmer, fontWeight: focused ? '800' : '600' }]} numberOfLines={1}>
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
  bar: { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8, borderTopWidth: 1 },
  tab: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconPill: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 18 },
})
