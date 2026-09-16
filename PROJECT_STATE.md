# songKHEM — Technical Project State & Architecture Specification

**Last Updated:** September 2026  
**Status:** Functional Prototype / Alpha Release  
**Primary Target Audience:** Visually impaired individuals, low-vision readers, and accessibility researchers working with Khmer script documents.

---

## 1. Executive Summary

**songKHEM** is an accessibility-first Single Page Application (SPA) built with **Vue 3** and **Vite**. Its mission is to bridge the accessibility gap for Khmer-speaking individuals with visual impairments or blindness by converting physical documents, camera captures, and digital files (PDF, images) into accessible, editable text via Optical Character Recognition (OCR), and subsequently vocalizing the text with natural-sounding Khmer Text-to-Speech (TTS) alongside real-time karaoke-style word highlighting.

---

## 2. Technology Stack & Dependencies

| Category | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | [Vue.js](https://vuejs.org/) | `^3.5.34` | Progressive JavaScript framework using `<script setup>` Composition API |
| **Build Tool & Bundler** | [Vite](https://vitejs.dev/) | `^8.0.12` | Next-generation frontend tooling and rapid HMR dev server |
| **Routing** | [Vue Router](https://router.vuejs.org/) | `^4.6.4` | Client-side routing with HTML5 History Mode |
| **Icons** | [Lucide Vue Next](https://lucide.dev/) | `^1.0.0` / `^1.18.0` | Accessible, clean vector iconography |
| **Styling** | Vanilla CSS3 (Custom Design Tokens) | Native | Scoped CSS with CSS Custom Properties, Glassmorphism, and responsive grids |
| **Fonts** | Google Fonts | Web API | `Kantumruy Pro`, `Battambang`, `Outfit`, `Inter` |
| **Speech & Audio** | Web Speech API + HTML5 Audio + Canvas | Native | Local TTS fallback, audio playback, and live canvas wave visualizer |

---

## 3. High-Level System Architecture

```
                                  +-----------------------+
                                  |      Browser UI       |
                                  | (Vue 3 + CSS Tokens)  |
                                  +-----------+-----------+
                                              |
                   +--------------------------+--------------------------+
                   |                                                     |
       [Document Input Pipeline]                              [Audio Playback Engine]
                   |                                                     |
  +----------------+---------------+                    +----------------+----------------+
  |                                |                    |                                 |
File Upload                   Live Camera           Azure Neural TTS                Web Speech API
(Drag & Drop / Picker)    (MediaDevices getUserMedia)   (SSML km-KH-Piseth / Sreymom)     (Browser Fallback)
  |                                |                    |                                 |
  +----------------+---------------+                    +----------------+----------------+
                   |                                                     |
     [Fingerprint & LRU Caching]                              [Audio Blob / Stream]
                   |                                                     |
  +----------------+---------------+                    +----------------+----------------+
  |                                |                    |                |                |
Local Cache Hit?            Cloud OCR Call        HTML5 Audio      Karaoke Word    Canvas Dynamic
(Instant 0ms retrieval)      (Azure / Google)     Playback (MP3)   Highlighting    Wave Visualizer
```

---

## 4. Core Modules & Component Architecture

### 4.1. Global Shell (`src/App.vue`)
* **Clean Assistive Header**:
  * **Brand Mark & Spoken Status Banner**: Live spoken status pill (*"ជំនួយការត្រៀមរួចជាស្រេច"*).
  * **Voice Guidance Quick Toggle**: 1-click toggle for spoken UI guidance.
  * **Accessibility Settings Trigger (`Alt + A`)**: Modal with Visual, Audio, and Interaction tabs.
* **Tactile Bottom Navigation Bar**:
  * Fixed bottom bar with large touch targets (min 60px height) across 3 essential modes:
    * **Scan & Read (`Alt + 1`)**: Camera-first guided viewfinder and capture action.
    * **Document Reader (`Alt + 2`)**: Unified reading page, collapsible options drawer, and tactile audio deck.
    * **Recent Reads (`Alt + 3`)**: Accessible spoken library list with 1-tap replay and delete undo.

### 4.2. Views (`src/views/`)

#### 1. `LoginScreen.vue` (`/`)
* **Purpose**: Accessible landing and onboarding portal.
* **Key Features**:
  * Visual assistant onboarding highlighting camera-first assistance, natural speech, and WCAG 2.2 AAA.
  * **Instant Demo Access**: 1-click **[ សាកល្បងប្រើភ្លាមៗ (Try songKHEM Now) ]** hero button.
  * Standard authentication form fields and Google OAuth mockup.

#### 2. `HomeScreen.vue` (`/home`)
* **Purpose**: Primary mode-driven operational workspace.
* **Key Features**:
  * Simplified home screen with dominant **SCAN DOCUMENT** action and secondary shelf (Upload, Recent, Help, Settings).
  * Mode-based navigation with seamless automatic transition from Scan into Reading mode on OCR completion.
  * **Preloaded Realistic Khmer Sample Library**: Official Notice, Folk Story, Poem, and Pharmacy Receipt.
  * Multi-stage timeout-aware OCR processing state (>5s timeout notice) and actionable error cards with auto-focused **Scan Again** button.
  * **Global Keyboard Shortcuts**:
    * `Space`: Play / Pause TTS audio reading.
    * `Ctrl + Enter`: Trigger OCR scanning on current document.
    * `Esc`: Immediately halt audio playback / close dialogs.
    * `Alt + A`: Toggle Accessibility Settings Modal.
    * `Alt + 1 / 2 / 3`: Quick mode switching.
  * **Optimistic History Management**: Injects a shimmering "Pending..." item into history while OCR is processing.
  * **Interactive Toast & Undo System**: Non-blocking notifications with 6-second undo actions for deleted records.

---

### 4.3. Interactive Components (`src/components/`)

| Component | File Path | Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **`DocumentUploader.vue`** | [`src/components/DocumentUploader.vue`](file:///c:/Users/Asus/Desktop/OCR-for-impaired-user/src/components/DocumentUploader.vue) | Camera-first guided viewfinder with alignment HUD brackets, conversational guidance state machine (*Ready -> Position -> Detected -> Hold Steady*), dominant **[ ថតរូបភាពឯកសារ ]** button, camera permission recovery box, and file upload dropzone. |
| **`OcrPanel.vue`** | [`src/components/OcrPanel.vue`](file:///c:/Users/Asus/Desktop/OCR-for-impaired-user/src/components/OcrPanel.vue) | Clean reading page with generous Khmer line spacing (`1.85`), 3-level Karaoke highlighting (**Word**, **Sentence**, **Paragraph**), and collapsible secondary options drawer for zoom (`A-`, `A+`), copy, export, and edit. |
| **`TtsPanel.vue`** | [`src/components/TtsPanel.vue`](file:///c:/Users/Asus/Desktop/OCR-for-impaired-user/src/components/TtsPanel.vue) | Dedicated tactile player deck with giant Play/Pause button (`Space`), stop (`Esc`), jump steppers (`-10`, `+10`), speed presets (`0.75x`–`2.0x`), voice selector, and Scan Again action. |
| **`UserHistory.vue`** | [`src/components/UserHistory.vue`](file:///c:/Users/Asus/Desktop/OCR-for-impaired-user/src/components/UserHistory.vue) | Semantic accessible list with document title, date/time, word count, 1-tap replay, open in reader, share/copy, rename, and spoken undo. |
| **`HelpModal.vue`** | [`src/components/HelpModal.vue`](file:///c:/Users/Asus/Desktop/OCR-for-impaired-user/src/components/HelpModal.vue) | Accessible 5-step onboarding and instructions modal explaining the scan, capture, OCR, and read aloud flow. |
| **`AppToast.vue`** | [`src/components/AppToast.vue`](file:///c:/Users/Asus/Desktop/OCR-for-impaired-user/src/components/AppToast.vue) | Accessible toast notification container with polite live regions and action callback triggers (Undo). |

---

## 5. Services & Integration Layer (`src/services/`)

### 5.1. OCR Service (`src/services/ocr.js`)
* **Google Cloud Vision Integration**:
  * Endpoint: `https://vision.googleapis.com/v1/images:annotate?key={API_KEY}`
  * Feature: `DOCUMENT_TEXT_DETECTION` (specifically tailored for dense print/paper).
  * Context Hint: `languageHints: ['km']` (guiding OCR model specifically to Khmer glyphs).
* **Microsoft Azure Computer Vision Integration**:
  * Endpoint: `{ENDPOINT}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=read`
  * Header: `Ocp-Apim-Subscription-Key: {API_KEY}`
  * Payload: Direct binary stream (`application/octet-stream`).
* **Offline / Simulation Fallback**:
  * If no API keys are present in `.env`, simulates processing latency (1.4s) and returns high-quality Khmer text samples to ensure zero-crash evaluator functionality.

### 5.2. TTS Service (`src/services/tts.js`)
* **Microsoft Azure Cognitive Speech Service**:
  * Endpoint: `https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1`
  * Header: `X-Microsoft-OutputFormat: audio-16khz-32kbitrate-mono-mp3`
  * Output: Returns an audio `Blob` converted to an ephemeral `blob:` URL.
  * SSML Specification:
    ```xml
    <speak version='1.0' xml:lang='km-KH'>
      <voice xml:lang='km-KH' xml:gender='{gender}' name='{voiceName}'>
        <prosody rate='{rateString}' pitch='{pitchString}'>
          {text}
        </prosody>
      </voice>
    </speak>
    ```
  * Supported Neural Voices:
    * `km-KH-PisethNeural` (Male)
    * `km-KH-SreymomNeural` (Female)
* **Web Speech API Fallback**:
  * If Azure keys are absent or network requests fail, automatically falls back to native `window.speechSynthesis` with system voices.

### 5.3. Caching & Performance Engine (`src/services/cache.js`)
* **File Fingerprinting**:
  * Uses a content-aware hashing algorithm combining `name`, `size`, `lastModified`, and a binary slice of the initial 2KB to create an invariant hash ID.
* **LRU OCR Caching**:
  * Stores up to **35 scanned documents** in `localStorage` under `songkhem_ocr_cache`.
  * Automatically evicts the least recently accessed documents when the capacity limit is exceeded.
* **In-Memory TTS Audio Cache**:
  * Pools up to **25 synthesized audio blob URLs** keyed by text hash, voice name, and speech rate to eliminate duplicate API costs and provide instant (0ms) playback on repeat clicks.

---

## 6. Accessibility & WCAG 2.2 AAA Implementation

1. **Visual Contrast Modes**:
   * **Sleek Midnight (`theme-dark`)**: Ambient glassmorphism with deep navy-slate backgrounds (`#090d16`) and glowing amber/indigo accents.
   * **Ultra High Contrast (`theme-contrast`)**: Strict black background (`#000000`), pure yellow text and borders (`#ffeb3b`), high visual separation designed for low-vision and cataract patients.
   * **Clean Light (`theme-light`)**: High-contrast white/light-gray background with slate-950 text and crisp borders.
2. **Dynamic Font Rescaling**:
   * CSS Custom Property `--font-scale` dynamically multiplies base root rem sizes across all typography without clipping or horizontal overflow.
3. **Screen Reader & Keyboard Optimization**:
   * Skip links (`.skip-to-content`).
   * Explicit `aria-label`, `role="button"`, `role="group"`, and `aria-live="polite"` attributes across all components.
   * Focus rings (`:focus-visible`) styled with high-visibility 2px borders and offset rings.
   * Minimum touch/click target sizes of **44px – 48px** across all actionable controls.

---

## 7. Configuration & Environment Variables

Configuration is handled via `.env` (derived from `.env.example`):

```bash
# Google Cloud Vision API
VITE_GOOGLE_VISION_ENDPOINT=https://vision.googleapis.com/v1/images:annotate
VITE_GOOGLE_VISION_API_KEY=your_google_cloud_api_key_here

# Microsoft Azure Computer Vision (Image Analysis 4.0)
VITE_AZURE_VISION_ENDPOINT=https://<your-region>.api.cognitive.microsoft.com/
VITE_AZURE_VISION_API_KEY=your_azure_vision_key_here

# Microsoft Azure Speech Service (TTS)
VITE_AZURE_TTS_ENDPOINT=https://<your-region>.tts.speech.microsoft.com/cognitiveservices/v1
VITE_AZURE_TTS_API_KEY=your_azure_tts_key_here
```

*Note: If no keys are configured, songKHEM runs seamlessly in offline/simulation mode.*

---

## 8. Current Project State & Verification

* **Build Status**: Passing (`vite build` production-ready).
* **Package Structure**: Clean, zero superfluous npm dependencies.
* **Security**: API keys are client-configurable; all inputs are validated before DOM insertion.
* **Browser Compatibility**: Modern Evergreen Browsers (Chrome 90+, Edge 90+, Safari 14+, Firefox 88+).

---

## 9. Future Roadmap & Enhancement Opportunities

1. **Client-Side Offline Khmer OCR**: Integrate WebAssembly-based OCR (e.g., Tesseract.js with `khm` trained data) to enable 100% offline text extraction without requiring external cloud credentials.
2. **Continuous Paging & PDF Extraction**: Add multi-page document pagination and background processing for multi-page PDF documents.
3. **Voice Command System**: Speech recognition (STT) enabling users to control playback completely hands-free ("អាន" / Play, "ឈប់" / Stop, "លឿនជាងនេះ" / Faster).
4. **PWA & Offline Service Worker**: Add Progressive Web App manifest and service worker caching for offline mobile usage.
