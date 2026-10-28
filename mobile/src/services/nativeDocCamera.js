import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core'

// Android-only module in modules/songkhem-docscan: a camera view that streams a small brightness picture (the
// page is found in it by utils/documentDetector.js) and whose capture() returns just the page, cropped and
// straightened. Missing (iOS, or an older build) -> callers keep using the plain camera.
export const isDocCameraSupported = Boolean(requireOptionalNativeModule('SongkhemDocScan'))

export const DocCamera = isDocCameraSupported ? requireNativeViewManager('SongkhemDocScan') : null
