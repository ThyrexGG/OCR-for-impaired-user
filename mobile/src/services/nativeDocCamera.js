import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core'

// Android-only module in modules/songkhem-docscan: a camera view that streams a small brightness picture (the
// page is found in it by utils/documentDetector.js) and whose capture() returns just the page, cropped and
// straightened. Missing (iOS, or an older build) -> callers keep using the plain camera.
const Native = requireOptionalNativeModule('SongkhemDocScan')

export const isDocCameraSupported = Boolean(Native)

export const DocCamera = isDocCameraSupported ? requireNativeViewManager('SongkhemDocScan') : null

/**
 * Makes the phone's volume buttons take the photo (they stop changing the volume) until the returned
 * function is called. Does nothing where the module is missing.
 */
export const listenVolumeShutter = (onPress) => {
  if (!Native?.setVolumeShutter) return () => {}
  let sub = null
  try {
    sub = Native.addListener('onVolumeShutter', onPress)
    Native.setVolumeShutter(true)
  } catch (e) {}
  return () => {
    try { Native.setVolumeShutter(false) } catch (e) {}
    try { sub && sub.remove() } catch (e) {}
  }
}
