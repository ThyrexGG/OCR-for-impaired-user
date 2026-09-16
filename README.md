# 📖 songKHEM — Khmer Document OCR & Speech Reader

> **An accessibility-first web application enabling visually impaired and low-vision individuals to scan Khmer documents and listen to natural speech with karaoke-style word highlighting.**

[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![WCAG 2.2 AAA](https://img.shields.io/badge/Accessibility-WCAG%202.2%20AAA-amber?style=flat-square)](https://www.w3.org/WAI/standards-guidelines/wcag/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

---

## 🌟 Key Features

* **📷 Multi-Source Khmer OCR**: Extract Khmer script from uploaded images (PNG, JPG, WEBP), multi-page PDFs, or direct live camera feed with high-contrast positioning guides.
* **🎧 Natural Khmer Text-to-Speech (TTS)**: Synthesizes high-fidelity Khmer speech via Microsoft Azure Cognitive Speech (`km-KH-PisethNeural` and `km-KH-SreymomNeural`) with automatic Web Speech API fallback.
* **✨ Karaoke Word Highlighting**: Synchronized word-by-word visual highlighting and smooth auto-scrolling to assist low-vision and dual-sensory learners.
* **♿ WCAG 2.2 AAA Accessibility**:
  * **3 Contrast Themes**: *Sleek Midnight* (Dark), *Ultra High Contrast* (Pure Black & Amber for severe vision impairments), and *Clean Light*.
  * **Dynamic Font Scaler**: Global scaling from 90% up to 150% without layout disruption.
  * **UI Spoken Guidance**: Built-in screen reader mode announcing actions and buttons upon interaction.
  * **Accessible Keyboard Navigation**: Skip-to-content links, visible focus outlines, and keyboard shortcuts.
* **⚡ Intelligent Dual-Tier Caching**:
  * Content-aware fingerprinting avoids redundant OCR requests.
  * In-memory audio caching for instant, zero-latency playback of previously spoken segments.
* **🕒 History & Undo Management**: Saves recent scans locally with instant reload, direct audio playback, and undoable deletion snackbars.

---

## 🚀 Quick Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (version 18 or higher recommended)
* `npm` or `yarn`

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/ThyrexGG/OCR-for-impaired-user.git
cd OCR-for-impaired-user
npm install
```

### 3. Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open your browser at `http://localhost:5173` to explore the application.

---

## ⚙️ Environment Configuration

songKHEM can run in **offline/demo simulation mode** out of the box with zero configuration.

To enable live cloud OCR and neural TTS, copy `.env.example` to `.env` and provide your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```ini
# Google Cloud Vision OCR (Optional)
VITE_GOOGLE_VISION_ENDPOINT=https://vision.googleapis.com/v1/images:annotate
VITE_GOOGLE_VISION_API_KEY=your_google_cloud_vision_key

# Microsoft Azure Cognitive Vision OCR (Optional)
VITE_AZURE_VISION_ENDPOINT=https://<your-region>.api.cognitive.microsoft.com/
VITE_AZURE_VISION_API_KEY=your_azure_vision_key

# Microsoft Azure Cognitive Speech TTS (Optional)
VITE_AZURE_TTS_ENDPOINT=https://<your-region>.tts.speech.microsoft.com/cognitiveservices/v1
VITE_AZURE_TTS_API_KEY=your_azure_speech_key
```

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | Play / Pause Speech Playback | Global (when not typing in an input/textarea) |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Start OCR Scan on selected document | Global |
| <kbd>Esc</kbd> | Stop audio playback immediately | Global |
| <kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd> | Accessible focus traversal | All controls & interactive elements |

---

## 📁 Project Architecture

```
songkhem/
├── public/                  # Static assets, branding logo & SVG icons
├── src/
│   ├── assets/              # Stylesheets and media
│   ├── components/          # Reusable accessible Vue components
│   │   ├── AppToast.vue         # Toast notifications & undo snackbars
│   │   ├── DocumentUploader.vue # File picker, drag-drop & camera scanner
│   │   ├── OcrPanel.vue         # Editable text result with zoom & export
│   │   ├── TtsPanel.vue         # Audio deck, karaoke & canvas visualizer
│   │   └── UserHistory.vue      # Recent scan history & quick actions
│   ├── router/              # Vue Router navigation configurations
│   ├── services/            # Core business logic & cloud integrations
│   │   ├── cache.js             # LRU caching & fingerprinting
│   │   ├── ocr.js               # Google Vision & Azure Read API clients
│   │   └── tts.js               # Azure Cognitive Speech SSML synthesizer
│   ├── views/               # Page views
│   │   ├── HomeScreen.vue       # Main OCR & audio workspace
│   │   └── LoginScreen.vue      # Accessible landing & 1-click demo entry
│   ├── App.vue              # App shell, accessibility toolbar & speech engine
│   ├── main.js              # Application entry point
│   └── style.css            # Custom CSS tokens & high-contrast design system
├── PROJECT_STATE.md         # Comprehensive technical audit & specification
├── package.json             # Project metadata & scripts
└── vite.config.js           # Vite build pipeline configuration
```

---

## 📚 Technical Documentation

For an in-depth breakdown of system contracts, LRU caching policies, audio stream pipelines, and WCAG compliance criteria, read the [Technical Project State Document](PROJECT_STATE.md).

---

## 🛡️ License

This project is open source and available under the [MIT License](LICENSE).
