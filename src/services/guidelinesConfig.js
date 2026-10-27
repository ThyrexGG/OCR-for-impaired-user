import { 
  Languages, HelpCircle, Sliders, Navigation, Upload, FileText, Sparkles,
  BookOpen, AudioLines, MoreHorizontal, PlayCircle, Fingerprint, History, Trash2, RotateCcw 
} from 'lucide-vue-next'
import { storage, STORAGE_KEYS } from './storage'

/**
 * SOLID (Open/Closed Principle & Single Responsibility):
 * Step definitions isolated from presentation component.
 * Walks through Header controls -> Navigation -> Upload/Samples -> Document Reader features.
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
  },
  {
    id: 'reader-karaoke',
    icon: BookOpen,
    mode: 'reader',
    targetSelector: '.reader-paragraph:first-child',
    fallbackSelector: '.reader-text-container',
    titleKm: 'ការអានតាមពាក្យ (Karaoke)',
    titleEn: 'Word-by-Word Reading',
    descKm: 'ពាក្យក្នុងឯកសារនឹងត្រូវបន្លិចពណ៌លឿងតាមសំឡេងអាន។ អ្នកអាចចុចលើពាក្យណាមួយ ដើម្បីស្តាប់ពីពាក្យនោះភ្លាមៗ។',
    descEn: 'Words are highlighted in sync with audio. Tap any word to seek and listen from that exact point.',
    preferredDock: 'bottom'
  },
  {
    id: 'reader-scrubber',
    icon: AudioLines,
    mode: 'reader',
    targetSelector: '.reader-spotify-scrubber',
    fallbackSelector: '.reader-bottom-player-bar',
    titleKm: 'របារវឌ្ឍនភាពការអាន',
    titleEn: 'Reading Progress Scrubber',
    descKm: 'បង្ហាញរយៈពេលដែលបានអាន និងរយៈពេលនៅសល់។ អ្នកអាចអូស ឬចុចលើរបារនេះ ដើម្បីរំលងទៅផ្នែកណាមួយនៃឯកសារ។',
    descEn: 'Displays elapsed and remaining time. Drag or tap along the bar to scrub through the audio.',
    preferredDock: 'top'
  },
  {
    id: 'reader-voice',
    icon: MoreHorizontal,
    mode: 'reader',
    targetSelector: '.spotify-more-options-btn',
    fallbackSelector: '.spotify-scrub-header',
    titleKm: 'ជម្រើសសំឡេង (...)',
    titleEn: 'Voice & Speed Options (...)',
    descKm: 'ចុចសញ្ញាចុចបី (...) នៅលើរបារវឌ្ឍនភាព ដើម្បីប្តូរសំឡេង AI ខ្មែរ (ស្រីមុំ, ពិសិដ្ឋ, សុខា, songKHEM-VITS) និងកែសម្រួលល្បឿនអាន។',
    descEn: 'Tap the three dots (...) above the progress bar to switch between Khmer AI voices and adjust reading speed.',
    preferredDock: 'top'
  },
  {
    id: 'reader-controls',
    icon: PlayCircle,
    mode: 'reader',
    targetSelector: '.player-controls-cluster.spotify-cluster',
    fallbackSelector: '.btn-hero-play',
    titleKm: 'ឧបករណ៍បញ្ជាសំឡេង',
    titleEn: 'Playback Controls',
    descKm: 'ប៊ូតុងថយក្រោយ ៥ ពាក្យ, ប៊ូតុងធំបើក/ផ្អាកការអាន (Play/Pause), និងប៊ូតុងរំលងទៅមុខ ៥ ពាក្យ។',
    descEn: 'Rewind 5 words (Prev), large Play/Pause hero button, and skip forward 5 words (Skip).',
    preferredDock: 'top'
  },
  {
    id: 'reader-gesture',
    icon: Fingerprint,
    mode: 'reader',
    targetSelector: '.reader-fab-trigger',
    fallbackSelector: '.reader-speed-dial-anchor',
    titleKm: 'ប៊ូតុងកាយវិការជំនួយ',
    titleEn: 'Gesture Assist Button',
    descKm: 'សង្កត់ប៊ូតុងនេះឱ្យជាប់ ដើម្បីបើកមុខងារសង្ខេបខ្លឹមសារ (Summarize) និងចម្លងអត្ថបទ (Copy) យ៉ាងរហ័ស។',
    descEn: 'Hold this floating button to smoothly pop out quick actions: Summarize document and Copy text.',
    preferredDock: 'top'
  },
  {
    id: 'history-list',
    icon: History,
    mode: 'recent',
    targetSelector: '.history-list-row:first-child',
    fallbackSelector: '.recent-reads-shelf',
    titleKm: 'ប្រវត្តិឯកសារដែលបានអាន',
    titleEn: 'Reading History Shelf',
    descKm: 'រាល់ឯកសារដែលអ្នកបានស្កេន ឬផ្ទុកឡើង នឹងត្រូវបានរក្សាទុកនៅទីនេះដោយស្វ័យប្រវត្តិតាមលំដាប់កាលបរិច្ឆេទ។',
    descEn: 'All your previously scanned and uploaded documents are automatically saved here chronologically.',
    preferredDock: 'bottom'
  },
  {
    id: 'history-open',
    icon: BookOpen,
    mode: 'recent',
    targetSelector: '.history-list-row:first-child .btn-row-open',
    fallbackSelector: '.btn-row-open',
    titleKm: 'បើកអានឡើងវិញភ្លាមៗ',
    titleEn: 'Reopen in Reader',
    descKm: 'ចុចប៊ូតុង "អាន" ដើម្បីបើកស្តាប់ឯកសារឡើងវិញភ្លាមៗ ដោយមិនបាច់ចំណាយពេលស្កេនម្តងទៀត។',
    descEn: 'Tap the "Read" button to reopen and listen to the document immediately without rescanning.',
    preferredDock: 'bottom'
  },
  {
    id: 'history-delete',
    icon: Trash2,
    mode: 'recent',
    targetSelector: '.history-list-row:first-child .btn-row-delete-action',
    fallbackSelector: '.btn-row-delete-action',
    titleKm: 'លុបឯកសារមួយៗ',
    titleEn: 'Delete Document',
    descKm: 'ចុចប៊ូតុងធុងសំរាម ដើម្បីលុបឯកសារណាមួយដែលលែងត្រូវការចេញពីប្រវត្តិអាន។',
    descEn: 'Tap the trash icon to remove an individual document from your reading records.',
    preferredDock: 'bottom'
  },
  {
    id: 'history-clear',
    icon: RotateCcw,
    mode: 'recent',
    targetSelector: '.btn-clear-all-bottom',
    fallbackSelector: '.shelf-footer',
    titleKm: 'សម្អាតប្រវត្តិអាន',
    titleEn: 'Clear History',
    descKm: 'អ្នកអាចលុបឯកសារម្តងមួយ ឬចុច "សម្អាតប្រវត្តិអានទាំងអស់" នៅខាងក្រោម ដើម្បីលុបទិន្នន័យចាស់ៗដែលមិនត្រូវការ។',
    descEn: 'Delete items individually or tap "Clear all reading history" at the bottom to clean up old files.',
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
