/**
 * Every way a scan can fail, said simply: a short title, one sentence on what to do next, and whether trying
 * the same photo again could help. Services throw ScanError(kind); anything else (a dropped connection, a
 * timeout, a crash) is sorted into a kind by classifyScanError, so no raw technical message reaches the user.
 * `en` is for the developer console only; the site speaks and shows the Khmer. Same list as the app's
 * mobile/src/services/scanErrors.js: keep the two in step.
 */
export class ScanError extends Error {
  constructor(kind, detail) {
    super(detail || kind)
    this.name = 'ScanError'
    this.kind = kind
  }
}

export const SCAN_ERRORS = {
  no_text: {
    title: 'រកមិនឃើញអក្សរ',
    say: 'សូមថតម្តងទៀតនៅកន្លែងភ្លឺ ហើយកាន់ទូរស័ព្ទឱ្យនឹង។',
    en: 'No text found. Take the photo again in a bright place and hold the phone steady.',
    tips: [
      'ថតនៅកន្លែងដែលមានពន្លឺគ្រប់គ្រាន់។',
      'កាន់ទូរស័ព្ទឱ្យនឹង កុំឱ្យរំញ័រ។',
      'ដាក់ទូរស័ព្ទឱ្យជិតអត្ថបទជាងមុន។',
      'ឱ្យឃើញក្រដាសទាំងមូលនៅក្នុងកាមេរ៉ា។',
    ],
    retry: false,
  },
  offline: {
    title: 'គ្មានអ៊ីនធឺណិត',
    say: 'សូមបើក Wi-Fi ឬទិន្នន័យទូរស័ព្ទ ហើយចុច ព្យាយាមម្តងទៀត។',
    en: 'No internet. Turn on Wi-Fi or mobile data, then tap Try again.',
    retry: true,
  },
  slow: {
    title: 'អ៊ីនធឺណិតយឺតពេក',
    say: 'សូមរង់ចាំបន្តិច ហើយចុច ព្យាយាមម្តងទៀត។',
    en: 'The internet is too slow. Wait a moment, then tap Try again.',
    retry: true,
  },
  busy: {
    title: 'ស្កេនញឹកញាប់ពេក',
    say: 'សូមរង់ចាំប្រហែល ១០ នាទី ហើយព្យាយាមម្តងទៀត។',
    en: 'Too many scans in a short time. Wait about 10 minutes, then try again.',
    retry: true,
  },
  monthly_limit: {
    title: 'អស់ចំនួនស្កេនសម្រាប់ខែនេះ',
    say: 'ការស្កេននឹងអាចប្រើបានវិញនៅដើមខែក្រោយ។',
    en: "This month's scans are used up. Scanning works again at the start of next month.",
    retry: false,
  },
  outdated: {
    title: 'កម្មវិធីនេះហួសសម័យ',
    say: 'សូមដំឡើងកំណែថ្មីរបស់ songKHEM។',
    en: 'This copy of the app is out of date. Install the new version.',
    retry: false,
  },
  server: {
    title: 'ម៉ាស៊ីនស្កេនមិនឆ្លើយតប',
    say: 'នេះមិនមែនជាកំហុសរបស់អ្នកទេ។ សូមព្យាយាមម្តងទៀតក្នុងពេលបន្តិចទៀត។',
    en: "The scanning service isn't responding. It's not your fault. Try again in a moment.",
    retry: true,
  },
  bad_file: {
    title: 'មិនអាចបើកឯកសារនេះបានទេ',
    say: 'សូមជ្រើសរូបភាព ឬឯកសារ PDF ផ្សេង។',
    en: "This file can't be opened. Choose a different photo or PDF.",
    retry: false,
  },
  settings: {
    title: 'ការកំណត់មិនទាន់រួចរាល់',
    say: 'សូមពិនិត្យសោ API ក្នុងផ្ទាំងការកំណត់។',
    en: 'A setting is missing. Check the API key in Settings.',
    retry: false,
  },
  unknown: {
    title: 'មានបញ្ហាមិនរំពឹងទុក',
    say: 'សូមព្យាយាមម្តងទៀត។',
    en: 'Something went wrong. Try again.',
    retry: true,
  },
}

/** @returns {keyof SCAN_ERRORS} */
export const classifyScanError = (error) => {
  if (error?.kind && SCAN_ERRORS[error.kind]) return error.kind
  if (error?.name === 'AbortError') return 'slow'
  // fetch rejects with a TypeError when there is no connection at all
  if (/network request failed|failed to fetch|network error/i.test(String(error?.message || ''))) return 'offline'
  return 'unknown'
}
