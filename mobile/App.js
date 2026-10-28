import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Suwannaphum_400Regular, Suwannaphum_700Bold } from '@expo-google-fonts/suwannaphum'
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible'

import { ThemeProvider, useTheme } from './src/theme/ThemeContext'
import { AppProvider } from './src/context/AppContext'
import { OcrProvider } from './src/context/OcrContext'
import { TtsProvider } from './src/context/TtsContext'
import { TourProvider } from './src/context/TourContext'
import RootNavigator from './src/navigation/RootNavigator'
import { navigationRef } from './src/navigation/navigationRef'
import ToastHost from './src/components/ToastHost'
import OcrEngineHost from './src/components/OcrEngineHost'

SplashScreen.preventAutoHideAsync().catch(() => {})

function AppShell() {
  const { currentTheme } = useTheme()

  return (
    <View style={styles.flex}>
      <StatusBar style={currentTheme === 'light' ? 'dark' : 'light'} />
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      <ToastHost />
      <OcrEngineHost />
    </View>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Suwannaphum_400Regular,
    Suwannaphum_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  })

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded])

  if (!fontsLoaded) {
    return null
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <ThemeProvider>
        <AppProvider>
          <OcrProvider>
            <TtsProvider>
              <TourProvider>
                <AppShell />
              </TourProvider>
            </TtsProvider>
          </OcrProvider>
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
