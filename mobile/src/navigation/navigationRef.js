import { createNavigationContainerRef } from '@react-navigation/native'

// Lets non-visual code (OcrContext's OCR/sample/history completion handlers)
// switch tabs the same way HomeScreen.vue's setMode('reader') did — decoupled
// from any specific screen component.
export const navigationRef = createNavigationContainerRef()

export function navigateToReader() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: 'Reader' })
  }
}

export function navigateToUpload() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: 'Upload' })
  }
}

export function navigateToCamera() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: 'Camera' })
  }
}
