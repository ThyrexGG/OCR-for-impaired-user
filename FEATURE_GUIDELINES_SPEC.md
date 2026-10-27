# songKHEM - Accessible Feature Guidelines Specification & Expert Debate

**Author:** songKHEM Accessibility & Engineering Team  
**Status:** In Review & Debate  
**Date:** October 2026  
**Audience:** Visual Impairment (Low Vision, Blind, High-Contrast Users)

---

## 1. Feature Intent & Goal

Provide a guided, step-by-step onboarding walkthrough ("Feature Guidelines") that introduces users to core songKHEM functions:
1. Explaining what each feature does in **both Khmer and English**.
2. Isolating attention by dimming non-relevant elements and spotlighting the active control.
3. Ensuring screen reader users receive synchronized announcements matching the visual text.
4. Offering intuitive navigation via 3 persistent buttons: **Previous (ថយក្រោយ)**, **Continue (បន្ត)**, and **Skip (រំលង)**.

---

## 2. Expert Accessibility Debate (Challenging Assumptions)

As accessibility engineers, we cannot simply implement a traditional sighted "coach mark / spotlight" library. Doing so will introduce severe accessibility regressions for visually impaired users. Below are the critical architectural debates:

### Debate 1: The "Dimming Backdrop" Risk for Low-Vision & High-Contrast Users
- **The Assumption:** Putting a dark dimmed overlay (`rgba(0,0,0,0.7)`) over the background helps visually impaired users focus on the active feature.
- **The Expert Critique:**
  1. *Contrast degradation:* Low-vision users often rely on custom screen filters, ambient light, or high-contrast themes. Dimming can drop surrounding contrast below WCAG AAA thresholds or make the page appear "turned off."
  2. *High-contrast mode failure:* In Windows High Contrast or our `data-theme="contrast"`, semi-transparent black overlays render as solid black blocks, completely obscuring elements or breaking native focus indicators.
  3. *Screen magnifier confusion:* Users with 400% zoom (ZoomText, Windows Magnifier) see only a tiny slice of the screen. If the background dims unexpectedly, they cannot see why their controls stopped responding.
- **Proposed Solution:**
  - Instead of only darkening the background, render a **3px high-visibility pulsating focus halo** (`--focus` blue or `#FFFF00` in contrast mode) directly around the target element.
  - In dark/contrast modes, keep the overlay subtle (`rgba(0,0,0,0.4)`) with an SVG cutout around the active control, maintaining 2px solid white/yellow borders around the cutout per `SURFACES.md`.

---

### Debate 2: "Only the Focused Feature is Clickable" vs Accidental State Mutation
- **Decision:** **Option B (Card-Driven Walkthrough) Confirmed.**
- **Implementation:**
  - The primary progression mechanism is always the **Continue (បន្ត)** button in the guideline card.
  - The highlighted target element is visually spotlighted with a glowing halo, but interactive click events on the background are absorbed to protect the user from accidental camera triggers, file dialogs, or history deletion during the tour.

---

### Debate 3: Screen Reader Synchronization (TalkBack, NVDA, VoiceOver)
- **The Assumption:** Setting the element's `alt` text to match the guide description will make screen readers understand it.
- **The Expert Critique:**
  - Buttons do not use `alt` (which is for `<img>`). Buttons use `aria-label` or `aria-describedby`.
  - If we change the button's permanent `aria-label` to a long tutorial description, the user learns an incorrect label that will disappear after the tutorial ends!
  - If a screen reader moves focus to the highlighted button, the user will NOT hear the "Previous / Continue / Skip" buttons unless they manually search the DOM.
- **Proposed Solution:**
  1. Use standard WAI-ARIA Dialog semantics:
     - The guideline box is a modal dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="guide-step-title"`, `aria-describedby="guide-step-desc"`.
  2. Associate the target element dynamically using `aria-details="guide-target-element"` or programmatically announce:  
     `"ជំហានទី [X]: [ឈ្មោះមុខងារ] - [ការពិពណ៌នា]"`.
  3. When the step changes, programmatic focus shifts to the Guideline Card title, ensuring TalkBack/NVDA reads the explanation first, followed by the Next/Skip buttons.

---

### Debate 4: Dual Audio Collision (Native Screen Reader vs App Voice Guidance)
- **The Context:** songKHEM has a built-in Khmer TTS audio guide (`useA11yPreferences: isUiVoiceEnabled`) designed for blind users who do not have an installed Khmer screen reader.
- **The Trap:** If a user already has TalkBack/NVDA running, and our tutorial automatically triggers Azure/WebSpeech audio, both voices will speak simultaneously, creating incomprehensible audio chaos.
- **Proposed Solution:**
  - Gated audio: Only trigger spoken guide audio if `isUiVoiceEnabled === true`.
  - Provide an instant Mute/Voice toggle directly inside the tutorial header.
  - Cancel previous speech synthesis immediately upon clicking **Continue** or **Previous**.

---

### Debate 5: Font Scaling (200%) & Mobile Viewport Constraints
- **The Context:** Low-vision users scale text up to 200% (`font-size: 2rem`).
- **The Trap:** A floating popover tooltip pointing to an element will overflow off-screen on a 375px mobile device, pushing the "Continue" or "Skip" buttons out of reach.
- **Proposed Solution:**
  - **Docked Sheet Pattern:** Instead of a floating absolute tooltip that can collide with edges, dock the guide container to either:
    - **Bottom of screen** (if highlighted target is in upper half).
    - **Top of screen** (if highlighted target is in lower half / bottom nav).
  - All buttons adhere to `--target-size-lg: 48px` minimum touch target with 8px gaps.

---

## 3. Revised Step-by-Step Walkthrough Sequence

| Step # | Target Feature | Khmer Description | English Description | Target Selector | Sheet Dock |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Step 1** | **Language Switcher (Header)** | ប្តូរភាសា៖ ចុចទីនេះដើម្បីប្តូររវាងភាសាខ្មែរ និងអង់គ្លេសភ្លាមៗ។ | Language Switcher: Toggle instantly between Khmer and English across the entire app. | `.lang-toggle-btn` | Bottom Dock |
| **Step 2** | **Accessibility Settings (Header)** | ការកំណត់ជំនួយ៖ កែសម្រួលទំហំអក្សរ កម្រិតពណ៌ និងបិទ/បើកសំឡេងណែនាំ។ | Accessibility Settings: Adjust text size, high contrast theme, and voice guidance. | `.settings-trigger-btn` | Bottom Dock |
| **Step 3** | **Home Navigation Bar** | របារប្តូរមុខងារ៖ ជ្រើសរើសរវាងការស្កេនកាមេរ៉ា ផ្ទុកឯកសារ ឬប្រវត្តិអាន។ | Navigation Bar: Switch between live camera scanning, file upload, or your reading history. | `.bottom-nav-bar` | Top Dock |
| **Step 4** | **Document Capture & Upload** | ថតរូប ឬផ្ទុកឯកសារ៖ ប្រើកាមេរ៉ាដើម្បីស្កេន ឬជ្រើសរើសឯកសាររូបភាព/PDF ដើម្បីបំប្លែងជាសំឡេង។ | Capture & Upload: Take a clear photo or upload an image/PDF document to convert into speech. | `.camera-actions-deck, .tactile-dropzone` | Top/Bottom Dock |
| **Step 5** | **Audio Playback & Reading** | ឧបករណ៍បញ្ជាសំឡេង៖ ចុចប៊ូតុងធំដើម្បីចាក់ ឬផ្អាកសំឡេងអាន និងរំលងពាក្យ។ | Audio Playback: Press the large center button to play/pause speech and navigate by word. | `.reader-bottom-player-bar` | Top Dock |

---

## 4. UI Specification: Guideline Container

### Structure:
```
+-----------------------------------------------------------+
| [Step 1 of 5] [ខ្មែរ / EN]                 [Esc] [Skip / រំលង] |
+-----------------------------------------------------------+
| មុខងារ៖ របារប្តូរទិដ្ឋភាព (Mode Switcher)                      |
|                                                           |
| របារប្តូរមុខងារ៖ ជ្រើសរើសរវាងការស្កេនរូបភាព ផ្ទុកឯកសារ ឬប្រវត្តិអាន។   |
| Navigation bar: Switch between camera, upload, or history.|
+-----------------------------------------------------------+
| [ < ថយក្រោយ / Prev ]               [ បន្ត / Continue > ] |
+-----------------------------------------------------------+
```

### Accessibility Attributes:
- Container: `role="dialog"`, `aria-modal="true"`, `aria-live="polite"`
- Heading: `id="guideline-step-title"`
- Description: `id="guideline-step-desc"`
- Buttons:
  - Previous: `aria-label="ត្រឡប់ទៅជំហានមុន (Go to previous step)"` (disabled on Step 1)
  - Continue: `aria-label="បន្តទៅជំហានបន្ទាប់ (Continue to next step)"`
  - Skip: `aria-label="រំលងការណែនាំ (Skip feature tour)"`
- Keyboard shortcuts:
  - <kbd>→</kbd> or <kbd>Enter</kbd>: Continue
  - <kbd>←</kbd>: Previous
  - <kbd>Escape</kbd>: Skip / Close

---

## 5. Storage & Replayability
- **Storage key:** `localStorage.getItem('songkhem_guidelines_completed')`
- **Replay trigger:** Inside Settings Modal -> Interaction Tab -> "មើលការណែនាំឡើងវិញ (Replay Feature Guidelines)" button.
