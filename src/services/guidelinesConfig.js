import { Languages, HelpCircle, Mic, Sliders, Navigation, Upload, FileText, Sparkles } from 'lucide-vue-next'
import { storage, STORAGE_KEYS } from './storage'

/**
 * SOLID (Open/Closed Principle & Single Responsibility):
 * Step definitions isolated from presentation component.
 * Walks through Header controls (Language, Help, Voice, Settings) -> Home Navigation -> Upload -> Recents -> Samples.
 */
export const GUIDELINE_STEPS = [
  {
    id: 'language',
    icon: Languages,
    mode: 'scan',
    targetSelector: '.lang-toggle-btn',
    fallbackSelector: '.header-actions',
    titleKm: 'ប្តូរភាសា',
    titleEn: 'Language Switcher',
    descKm: 'ចុចទីនេះដើម្បីប្តូររវាងភាសាខ្មែរ និងអង់គ្លេសភ្លាមៗ លើគ្រប់ទិដ្ឋភាពទាំងអស់នៃកម្មវិធី។',
    descEn: 'Toggle instantly between Khmer and English across the entire application.',
    preferredDock: 'bottom'
  },
  {
    id: 'help',
    icon: HelpCircle,
    mode: 'scan',
    targetSelector: '.help-trigger-btn',
    fallbackSelector: '.header-actions',
    titleKm: 'ជំនួយការប្រើប្រាស់',
    titleEn: 'Help & Quick Guide',
    descKm: 'ចុចទីនេះដើម្បីមើលសេចក្តីណែនាំអំពីរបៀបប្រើប្រាស់កម្មវិធី និងផ្លូវកាត់ក្តារចុចសំខាន់ៗ។',
    descEn: 'Tap here to view user instructions, keyboard shortcuts, or replay this guided tour.',
    preferredDock: 'bottom'
  },
  {
    id: 'settings',
    icon: Sliders,
    mode: 'scan',
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
    mode: 'scan',
    targetSelector: '.bottom-nav-bar',
    fallbackSelector: '.app-main-content',
    titleKm: 'របារប្តូរមុខងារ',
    titleEn: 'Navigation Bar',
    descKm: 'ជ្រើសរើសរវាងការស្កេនកាមេរ៉ា ផ្ទុកឯកសារ ឬពិនិត្យប្រវត្តិអាន។',
    descEn: 'Switch between Camera scanning, File upload, or Reading history.',
    preferredDock: 'top'
  },
  {
    id: 'upload',
    icon: Upload,
    mode: 'upload',
    targetSelector: '.tactile-dropzone',
    fallbackSelector: '.btn-choose-file',
    titleKm: 'ផ្ទុកឯកសារឡើង',
    titleEn: 'Upload Document',
    descKm: 'ទម្លាក់ឯកសារ ឬចុចប៊ូតុងជ្រើសរើសរូបភាព ឬ PDF ពីឧបករណ៍របស់អ្នក ដើម្បីស្កេន និងអានជាសំឡេងភ្លាមៗ។',
    descEn: 'Drop or choose an image or PDF file from your device to scan and convert into spoken audio.',
    preferredDock: 'bottom'
  },
  {
    id: 'recent-docs',
    icon: FileText,
    mode: 'upload',
    targetSelector: '.recent-uploads-section',
    fallbackSelector: '.tactile-dropzone',
    titleKm: 'ឯកសារដែលបានផ្ទុកឡើងថ្មីៗ',
    titleEn: 'Recent Uploads',
    descKm: 'ចុចលើឯកសារដែលបានផ្ទុកឡើងពីមុន ដើម្បីបើកអាន និងស្តាប់ឡើងវិញភ្លាមៗ ដោយមិនបាច់ស្កេនម្តងទៀត។',
    descEn: 'Reopen your previously uploaded documents instantly without having to scan them again.',
    preferredDock: 'bottom'
  },
  {
    id: 'samples',
    icon: Sparkles,
    mode: 'upload',
    targetSelector: '.sample-library-section',
    fallbackSelector: '.sample-unboxed-list',
    titleKm: 'ឯកសារគំរូ',
    titleEn: 'Sample Documents',
    descKm: 'សាកល្បងអានឯកសារគំរូដូចជា អត្តសញ្ញាណប័ណ្ណ ឬវេជ្ជបញ្ជា ដោយមិនចាំបាច់មានឯកសារផ្ទាល់ខ្លួន។',
    descEn: 'Try reading sample documents like ID cards or medical prescriptions without uploading your own file.',
    preferredDock: 'top'
  }
]

/**
 * Filter steps dynamically based on available DOM / storage state
 * (e.g. only show Recent Uploads if user has past uploaded files)
 */
export function getAvailableSteps() {
  const history = storage.getJson(STORAGE_KEYS.HISTORY, [])
  const hasRecentHistory = Array.isArray(history) && history.length > 0
  const hasRecentInDom = typeof document !== 'undefined' && !!document.querySelector('.recent-uploads-section')

  return GUIDELINE_STEPS.filter(step => {
    if (step.id === 'recent-docs') {
      return hasRecentHistory || hasRecentInDom
    }
    return true
  })
}
