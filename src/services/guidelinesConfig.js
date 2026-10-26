import { Languages, Sliders, Navigation, Camera, Volume2 } from 'lucide-vue-next'

/**
 * SOLID (Open/Closed Principle & Single Responsibility):
 * Step definitions isolated from presentation component.
 * New walkthrough steps can be added here without modifying the UI engine.
 */
export const GUIDELINE_STEPS = [
  {
    id: 'language',
    icon: Languages,
    targetSelector: '.lang-toggle-btn',
    fallbackSelector: '.header-actions',
    titleKm: 'ប្តូរភាសា',
    titleEn: 'Language Switcher',
    descKm: 'ចុចទីនេះដើម្បីប្តូររវាងភាសាខ្មែរ និងអង់គ្លេសភ្លាមៗ លើគ្រប់ទិដ្ឋភាពទាំងអស់នៃកម្មវិធី។',
    descEn: 'Toggle instantly between Khmer and English across the entire application.',
    preferredDock: 'bottom'
  },
  {
    id: 'settings',
    icon: Sliders,
    targetSelector: '.settings-trigger-btn',
    fallbackSelector: '.header-actions',
    titleKm: 'ការកំណត់ជំនួយ',
    titleEn: 'Accessibility Settings',
    descKm: 'កែសម្រួលទំហំអក្សរ កម្រិតពណ៌ខ្មៅ-លឿង និងបិទ ឬបើកសំឡេងជំនួយស្វ័យប្រវត្តិតាមតម្រូវការ។',
    descEn: 'Adjust font scaling, high-contrast themes, and toggle automatic voice guidance.',
    preferredDock: 'bottom'
  },
  {
    id: 'navigation',
    icon: Navigation,
    targetSelector: '.bottom-nav-bar',
    fallbackSelector: '.app-main-content',
    titleKm: 'របារប្តូរមុខងារ',
    titleEn: 'Navigation Bar',
    descKm: 'ជ្រើសរើសរវាងការស្កេនកាមេរ៉ា ផ្ទុកឯកសារ ឬពិនិត្យប្រវត្តិអាន។',
    descEn: 'Switch between Camera scanning, File upload, or Reading history.',
    preferredDock: 'top'
  },
  {
    id: 'capture',
    icon: Camera,
    targetSelector: '.btn-shutter, .tactile-dropzone',
    fallbackSelector: '.app-main-content',
    titleKm: 'ថតរូប ឬផ្ទុកឯកសារ',
    titleEn: 'Capture & Upload',
    descKm: 'តម្រង់កាមេរ៉ាទៅលើអត្ថបទ រួចចុចប៊ូតុងថត ឬផ្ទុកឯកសាររូបភាព/PDF ដើម្បីបំប្លែងជាអក្សរ។',
    descEn: 'Align your camera over text and press shutter, or upload an image/PDF document to extract text.',
    preferredDock: 'top'
  },
  {
    id: 'reader',
    icon: Volume2,
    targetSelector: '.reader-bottom-player-bar, .header-brand-cluster',
    fallbackSelector: '.assistive-header',
    titleKm: 'ឧបករណ៍អានជាសំឡេង',
    titleEn: 'Audio Player',
    descKm: 'ចុចប៊ូតុងធំកណ្តាលដើម្បីចាក់ ឬផ្អាកសំឡេងអាន និងចុចលើពាក្យនីមួយៗដើម្បីស្តាប់ឡើងវិញ។',
    descEn: 'Press the large center button to play/pause speech, and tap individual words to seek audio.',
    preferredDock: 'top'
  }
]
