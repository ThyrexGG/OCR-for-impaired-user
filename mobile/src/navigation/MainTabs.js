import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Camera, Upload, History } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from '../components/AccessiblePressable'
import AppHeader from '../components/AppHeader'
import SettingsModal from '../components/SettingsModal'
import HelpModal from '../components/HelpModal'
import TourOverlay from '../components/TourOverlay'
import { useTour, useTourTarget } from '../context/TourContext'
import { shellFor } from '../theme/shell'
import CameraScreen from '../screens/CameraScreen'
import UploadScreen from '../screens/UploadScreen'
import ReaderScreen from '../screens/ReaderScreen'
import RecentScreen from '../screens/RecentScreen'

const Tab = createBottomTabNavigator()

// The reader is a full-screen page (own top bar + player bar, like the web's
// reader mode), so it is a route but not one of the bottom tabs.
const TAB_ICONS = { Camera, Upload, Recent: History }

function ShellHeader() {
  const { currentTheme } = useTheme()
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: shellFor(currentTheme).headerBg }}>
      <AppHeader />
    </SafeAreaView>
  )
}

// Mirrors App.vue's shell: a header above the routed content, a 3-tab bottom nav
// (Camera / Upload / Recent) and the Settings/Help modals mounted once here.
export default function MainTabs() {
  const { isTourActive, offerIfFirstTime } = useTour()

  // First launch only: offer the guided tour once the screen has settled
  useEffect(() => {
    const id = setTimeout(offerIfFirstTime, 1200)
    return () => clearTimeout(id)
  }, [offerIfFirstTime])

  return (
    <View style={styles.flex}>
      {/* While the tour is up, a screen reader should only see the tour card, not the app behind it */}
      <View style={styles.flex} importantForAccessibility={isTourActive ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={isTourActive}>
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
      </View>
      <SettingsModal />
      <HelpModal />
      <TourOverlay />
    </View>
  )
}

// The web's `.bottom-nav-bar`: icon + label per tab, the active tab gets a soft
// pill behind its icon. Hidden on the reader, which brings its own bottom bar.
function PillTabBar({ state, descriptors, navigation }) {
  const { currentTheme } = useTheme()
  const insets = useSafeAreaInsets()
  const shell = shellFor(currentTheme)
  const tabsTourRef = useTourTarget('tabs')

  if (state.routes[state.index].name === 'Reader') return null

  return (
    <View
      ref={tabsTourRef}
      collapsable={false}
      style={[
        tabStyles.bar,
        {
          backgroundColor: shell.navBg,
          borderTopColor: shell.navBorder,
          borderTopWidth: shell.navBorderWidth,
          height: 80 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={tabStyles.inner}>
      {state.routes.map((route, index) => {
        const Icon = TAB_ICONS[route.name]
        if (!Icon) return null
        const { options } = descriptors[route.key]
        const focused = state.index === index
        const color = focused ? shell.pillIcon : shell.tab

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
            <View style={[tabStyles.iconPill, focused && { backgroundColor: shell.pill, borderWidth: shell.pillBorder ? 1 : 0, borderColor: shell.pillBorder || 'transparent' }]}>
              <Icon size={24} color={color} />
            </View>
            <Text style={[tabStyles.label, { color: focused ? shell.labelActive : shell.tab, fontWeight: focused ? '600' : '500' }]} numberOfLines={1}>
              {options.tabBarLabel}
            </Text>
          </AccessiblePressable>
        )
      })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 } })

const tabStyles = StyleSheet.create({
  bar: { paddingHorizontal: 16, elevation: 2 },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { flex: 1, maxWidth: 120, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  iconPill: { width: 64, height: 32, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
})
