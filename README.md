# songKHEM

songKHEM is an accessibility-focused application that lets blind and low-vision users scan physical Khmer-language documents and listen to them read aloud, with word-by-word karaoke-style highlighting synchronized to the audio. The repository contains a Vue 3 web app and a companion Expo/React Native mobile app that share the same OCR and text-to-speech workflow.

## How it works

1. A document is captured from a live camera feed, an uploaded image (PNG/JPG/WEBP), or a multi-page PDF.
2. Text is extracted either on-device with Tesseract.js, or via a Google Cloud Vision OCR proxy for higher accuracy.
3. The recognized Khmer text is read aloud with Khmer neural voices (`km-KH-PisethNeural` / `km-KH-SreymomNeural`) through the `api/tts.js` function: a paid Azure Speech key when one is set, otherwise a zero-key stream. If both fail, the device's own voice is used.
4. Words are highlighted in sync with playback, and recent scans are kept in a local history for quick replay.

## Tech stack

**Web app** (repository root)
- Vue 3 + Vue Router, built with Vite
- Tesseract.js for client-side OCR, pdfjs-dist for PDF page extraction
- Two Vercel serverless functions (`api/ocr.js`, `api/tts.js`) that proxy Google Cloud Vision and Azure Speech so API keys never reach the browser

**Mobile app** (`mobile/`)
- Expo / React Native, with React Navigation (bottom tabs + native stack)
- Expo modules for camera, document picking, audio playback, file system access, haptics, and image manipulation
- Calls the same `api/ocr.js` and `api/tts.js` endpoints as the web app for cloud OCR/TTS

## Repository structure

```
.
├── src/                  # Vue 3 web app
│   ├── components/       # DocumentUploader, OcrPanel, TtsPanel, UserHistory, AppToast, HelpModal
│   ├── views/             # LoginScreen, HomeScreen
│   ├── services/          # ocr.js, ocrService.js, tts.js, cache.js, cloudApi.js, i18n.js, storage.js, announcer.js, haptics.js
│   ├── router/             # Vue Router configuration
│   └── composables/        # useA11yPreferences.js
├── api/                  # Vercel serverless functions (ocr.js, tts.js)
├── public/               # Static assets (favicon, icons, logo)
├── mobile/               # Expo / React Native app
│   ├── App.js
│   ├── src/screens/        # WelcomeScreen, UploadScreen, CameraScreen, ReaderScreen, RecentScreen
│   ├── src/components/     # Camera capture, OCR text view, TTS controls, history rows, modals, etc.
│   ├── src/context/        # AppContext, OcrContext, TtsContext
│   ├── src/services/       # ocr.js, tts.js, cache.js, cloudApi.js, ocrEngineBridge.js, sampleLibrary.js
│   └── src/navigation/     # RootNavigator, MainTabs
├── PROJECT_STATE.md      # Detailed technical audit / specification document
├── package.json          # Web app metadata and scripts
└── vite.config.js        # Vite build/dev configuration
```

## Getting started (web app)

### Prerequisites
- Node.js 18 or later
- npm

### Install and run
```bash
git clone https://github.com/ThyrexGG/OCR-for-impaired-user.git
cd OCR-for-impaired-user
npm install
npm run dev
```
The app runs at `http://localhost:5173`. Other available scripts: `npm run build` (production build) and `npm run preview` (preview the production build locally).

The web app works out of the box with no configuration, using on-device Tesseract.js OCR and the browser's built-in speech synthesis voices.

### Optional: cloud OCR and Khmer neural TTS

Cloud OCR (Google Vision) and Khmer neural TTS (Azure Speech) run through the two serverless functions in `api/`, so the underlying API keys stay server-side. To enable them in a Vercel deployment, set in **Project Settings → Environment Variables**:

```ini
GOOGLE_VISION_API_KEY=your_google_cloud_vision_key
AZURE_TTS_API_KEY=your_azure_speech_key
# Optional overrides
GOOGLE_VISION_ENDPOINT=https://vision.googleapis.com/v1/images:annotate
AZURE_TTS_ENDPOINT=https://<your-region>.tts.speech.microsoft.com/cognitiveservices/v1
```

Without `AZURE_TTS_API_KEY` the TTS function still works through a zero-key stream, an unofficial endpoint that may stop working without notice. `api/ocr.js` and `api/tts.js` rate-limit per caller, but only per warm instance; add a Vercel firewall rate-limit rule for a hard limit.

These must not be prefixed with `VITE_`, since Vite would bundle any `VITE_*` variable into the public client-side JavaScript.

`npm run dev` does not run the serverless functions locally. To use a deployed instance of them from the dev server, create a `.env` file with:

```ini
VITE_API_PROXY=https://<your-app>.vercel.app
```

Users can also enter their own Google/Azure API keys in the app's Settings panel; those are stored only in their own browser.

## Getting started (mobile app)

The mobile app lives in `mobile/` and is a separate Expo project.

```bash
cd mobile
npm install
npx expo start
```

From there, run on Android/iOS/web via Expo (`npm run android`, `npm run ios`, `npm run web`), or scan the QR code with the Expo Go app. See `mobile/.env.example` for the environment variables it expects (pointing at the same OCR/TTS API endpoints as the web app).

### Android camera and release builds

On Android the Camera tab uses a native module (`mobile/modules/songkhem-docscan`) that outlines the page in red and crops the photo to it, so it needs a development or release build; Expo Go does not include it. Build a standalone APK:

```bash
cd mobile
npx expo prebuild --platform android
cd android
NODE_ENV=production EXPO_PUBLIC_API_BASE_URL=https://<your-app>.vercel.app EXPO_PUBLIC_APP_KEY=<pass> ./gradlew assembleRelease
```

The APK is `app/build/outputs/apk/release/app-release.apk`. It is signed with the debug key, which is fine for sideloading but not for the Play Store.

The server only answers app builds that carry its pass: `EXPO_PUBLIC_APP_KEY` must be one of the comma-separated values in the Vercel env var `SONGKHEM_APP_KEY` (the website's own pages need no pass). To cut off APKs that were shared too widely, change `SONGKHEM_APP_KEY`, redeploy, and build new APKs with the new pass. Because this repository is public, the GitHub Actions workflow `build-apk.yml` only checks that the app builds and publishes nothing; share working APKs privately.

## Accessibility features

- Multiple contrast themes, including a high-contrast mode intended for severe vision impairment
- Adjustable font scaling
- Keyboard shortcuts for playback control and OCR scanning, and full keyboard focus traversal
- Screen-reader-oriented spoken UI guidance
- Scan history with local caching to avoid redundant OCR/TTS requests on repeated content

## License

No license file is currently included in this repository.
