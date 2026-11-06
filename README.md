# songKHEM

songKHEM is an accessibility-focused application that lets blind and low-vision users scan physical Khmer-language documents and listen to them read aloud, with word-by-word karaoke-style highlighting synchronized to the audio. The repository contains a Vue 3 web app and a companion Expo/React Native mobile app that share the same OCR and text-to-speech workflow.

## How it works

1. A document is captured from a live camera feed, an uploaded image (PNG/JPG/WEBP), or a multi-page PDF.
2. Text is extracted either on-device with Tesseract.js, or via a Google Cloud Vision OCR proxy for higher accuracy.
3. The recognized Khmer text is read aloud using Microsoft Azure Neural TTS (`km-KH-PisethNeural` / `km-KH-SreymomNeural`), with a Web Speech API fallback when Azure isn't configured.
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

## Accessibility features

- Multiple contrast themes, including a high-contrast mode intended for severe vision impairment
- Adjustable font scaling
- Keyboard shortcuts for playback control and OCR scanning, and full keyboard focus traversal
- Screen-reader-oriented spoken UI guidance
- Scan history with local caching to avoid redundant OCR/TTS requests on repeated content

## License

No license file is currently included in this repository.
