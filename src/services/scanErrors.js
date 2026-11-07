/**
 * Bilingual Scan Errors Dictionary & Classifier (Khmer & English)
 * Conforms to WCAG 2.2 AA and .agents/ProjectInstruction.md
 * Every error provides:
 *   - title: Human-readable headline
 *   - say: Natural guidance sentence for screen reader (TalkBack / Web Speech)
 *   - tips: Actionable bullet points explaining how to fix the issue
 *   - retry: Whether retrying the same scan can succeed
 */

export class ScanError extends Error {
  constructor(kind, detail) {
    super(detail || kind)
    this.name = 'ScanError'
    this.kind = kind
  }
}

export const SCAN_ERRORS = {
  offline: {
    retry: true,
    km: {
      title: 'គ្មានការតភ្ជាប់អ៊ីនធឺណិត',
      say: 'សូមពិនិត្យមើលប្រព័ន្ធ Wi-Fi ឬទិន្នន័យទូរស័ព្ទរបស់អ្នក ហើយព្យាយាមម្តងទៀត។',
      tips: [
        'បើក Wi-Fi ឬទិន្នន័យសេវាទូរស័ព្ទ (Cellular Data)។',
        'ពិនិត្យមើលថាតើទូរស័ព្ទស្ថិតក្នុង Airplane Mode ដែរឬទេ។',
        'រង់ចាំសេវាអ៊ីនធឺណិតមានស្ថិរភាព រួចចុច «ព្យាយាមម្តងទៀត»។'
      ]
    },
    en: {
      title: 'No Internet Connection',
      say: 'Please check your Wi-Fi or cellular data, then tap Try Again.',
      tips: [
        'Check that Wi-Fi or Mobile Data is turned on.',
        'Verify Airplane Mode is turned off.',
        'Wait for a stable connection, then tap "Try Again".'
      ]
    }
  },
  no_text: {
    retry: false,
    km: {
      title: 'រកមិនឃើញអត្ថបទទេ',
      say: 'សូមថតម្តងទៀតនៅកន្លែងភ្លឺច្បាស់ ហើយកាន់ទូរស័ព្ទឱ្យនឹងកុំឱ្យរំញ័រ។',
      tips: [
        'ថតនៅកន្លែងដែលមានពន្លឺគ្រប់គ្រាន់ គ្មានស្រមោលបាំង។',
        'កាន់ទូរស័ព្ទឱ្យនឹង កុំឱ្យព្រិលចលនា។',
        'ដាក់កាមេរ៉ាឱ្យជិតអត្ថបទ និងតម្រឹមឱ្យចំសន្លឹកក្រដាស។',
        'ប្រាកដថាទំព័រឯកសារទាំងមូលស្ថិតក្នុងស៊ុមថត។'
      ]
    },
    en: {
      title: 'No Text Detected',
      say: 'Please take the photo again in good lighting and hold your phone steady.',
      tips: [
        'Ensure bright, even lighting without heavy shadows.',
        'Hold your phone steady to prevent motion blur.',
        'Move the camera closer and center the text.',
        'Make sure the whole document page is inside the frame.'
      ]
    }
  },
  slow: {
    retry: true,
    km: {
      title: 'ការតភ្ជាប់អ៊ីនធឺណិតយឺតពេក',
      say: 'ដំណើរការស្កេនចំណាយពេលយូរជាងធម្មតា។ សូមរង់ចាំបន្តិច ហើយព្យាយាមម្តងទៀត។',
      tips: [
        'ពិនិត្យមើលល្បឿនសេវាអ៊ីនធឺណិតរបស់អ្នក។',
        'ផ្លាស់ប្តូរទៅប្រើបណ្តាញ Wi-Fi ដែលមានល្បឿនលឿនជាងមុន។',
        'ចុច «ព្យាយាមម្តងទៀត» ដើម្បីចាប់ផ្តើមឡើងវិញ។'
      ]
    },
    en: {
      title: 'Connection Timed Out',
      say: 'Scanning took longer than expected. Please check your connection and try again.',
      tips: [
        'Check your internet speed or network signal.',
        'Switch to a stronger Wi-Fi or mobile data network.',
        'Tap "Try Again" to retry.'
      ]
    }
  },
  busy: {
    retry: true,
    km: {
      title: 'ការស្កេនញឹកញាប់ពេក',
      say: 'ប្រព័ន្ធកំពុងមមាញឹក។ សូមរង់ចាំពីរបីនាទី រួចព្យាយាមម្តងទៀត។',
      tips: [
        'រង់ចាំប្រហែល ១ ទៅ ២ នាទីសិន។',
        'កុំចុចស្កេនផ្ទួនៗច្រើនដងពេក។',
        'ចុច «ព្យាយាមម្តងទៀត» បន្ទាប់ពីការរង់ចាំ។'
      ]
    },
    en: {
      title: 'Too Many Requests',
      say: 'The service is receiving too many requests. Please wait a moment and try again.',
      tips: [
        'Wait 1 to 2 minutes before requesting again.',
        'Avoid tapping scan repeatedly.',
        'Tap "Try Again" once the cooldown passes.'
      ]
    }
  },
  monthly_limit: {
    retry: false,
    km: {
      title: 'អស់ចំនួនស្កេនសម្រាប់ខែនេះ',
      say: 'អ្នកបានប្រើប្រាស់អស់កូតាស្កេនសម្រាប់ខែនេះហើយ។ ការស្កេននឹងបើកដំណើរការឡើងវិញនៅដើមខែក្រោយ។',
      tips: [
        'កូតាស្កេននឹងត្រូវបានកំណត់ឡើងវិញនៅថ្ងៃទី ១ នៃខែបន្ទាប់។',
        'អ្នកនៅតែអាចអានឯកសារគំរូ និងឯកសារដែលធ្លាប់បានស្កេនរួច។',
        'បើមានសោផ្ទាល់ខ្លួន សូមបញ្ចូលក្នុង «ការកំណត់» (Settings)។'
      ]
    },
    en: {
      title: 'Monthly Limit Reached',
      say: 'The free scanning limit for this month has been reached. It resets at the beginning of next month.',
      tips: [
        'Free quota automatically resets on the 1st of next month.',
        'You can still read previous documents in your history.',
        'To bypass limits, configure your own API key in Settings.'
      ]
    }
  },
  server: {
    retry: true,
    km: {
      title: 'ម៉ាស៊ីនបម្រើការមិនឆ្លើយតប',
      say: 'នេះមិនមែនជាកំហុសរបស់អ្នកទេ។ ម៉ាស៊ីនស្កេនកំពុងមានបញ្ហាបច្ចេកទេសបណ្តោះអាសន្ន។',
      tips: [
        'រង់ចាំបន្តិច រួចចុច «ព្យាយាមម្តងទៀត»។',
        'ពិនិត្យមើលថាតើទំព័រគេហទំព័រផ្សេងទៀតអាចបើកបានធម្មតាដែរឬទេ។',
        'ប្រសិនបើបញ្ហានៅតែបន្ត សូមសាកល្បងម្ដងទៀតនៅពេលក្រោយ។'
      ]
    },
    en: {
      title: 'Server Unreachable',
      say: 'This is not your fault. The scanning service is temporarily unavailable.',
      tips: [
        'Wait a moment and tap "Try Again".',
        'Check if other websites load normally on your device.',
        'If the issue persists, please try again later.'
      ]
    }
  },
  bad_file: {
    retry: false,
    km: {
      title: 'ឯកសារមិនត្រឹមត្រូវ ឬខូច',
      say: 'មិនអាចអានឯកសារនេះបានទេ។ សូមជ្រើសរើសរូបភាព ឬឯកសារ PDF ផ្សេង។',
      tips: [
        'ជ្រើសរើសរូបភាពប្រភេទ JPG, PNG, WEBP ឬឯកសារ PDF។',
        'ពិនិត្យមើលថាតើឯកសារមិនត្រូវបានខូចខាត ឬទទេស្អាត។',
        'ទំហំឯកសារមិនត្រូវលើសពី ៣០ MB ឡើយ។'
      ]
    },
    en: {
      title: 'Invalid or Corrupted File',
      say: 'This file cannot be read. Please choose a different photo or PDF document.',
      tips: [
        'Select a valid JPG, PNG, WEBP, or PDF file.',
        'Make sure the file is not empty or corrupted.',
        'Ensure file size is under 30 MB.'
      ]
    }
  },
  camera: {
    retry: true,
    km: {
      title: 'មិនអាចបើកកាមេរ៉ាបានទេ',
      say: 'សូមអនុញ្ញាតសិទ្ធិប្រើប្រាស់កាមេរ៉ាក្នុង Browser របស់អ្នក ដើម្បីស្កេនឯកសារ។',
      tips: [
        'ចុចលើរូបសោ (Lock icon) នៅលើរបារអាសយដ្ឋាន Browser។',
        'ជ្រើសរើស «អនុញ្ញាត» (Allow) សម្រាប់កាមេរ៉ា។',
        'ឬប្តូរទៅកាន់ផ្ទាំង «ផ្ទុកឯកសារ» (Upload) ដើម្បីជ្រើសរូបភាព។'
      ]
    },
    en: {
      title: 'Camera Access Blocked',
      say: 'Please allow camera permission in your browser to scan documents.',
      tips: [
        'Tap the lock icon in your browser address bar.',
        'Set Camera access to "Allow".',
        'Or switch to the "Upload" tab to select an image file.'
      ]
    }
  },
  settings: {
    retry: false,
    km: {
      title: 'ការកំណត់មិនទាន់ត្រឹមត្រូវ',
      say: 'សូមពិនិត្យមើលសោ API ឬការកំណត់ក្នុងផ្ទាំងការកំណត់។',
      tips: [
        'ចូលទៅកាន់ផ្ទាំង «ការកំណត់» (Settings)។',
        'ពិនិត្យមើលសោ Azure ឬ Google Vision API របស់អ្នក។',
        'ឬជ្រើសរើសម៉ាស៊ីនស្កេនលំនាំដើម (Tesseract) វិញ។'
      ]
    },
    en: {
      title: 'Configuration Missing',
      say: 'Please check your API key or endpoint in Settings.',
      tips: [
        'Open the Settings menu.',
        'Verify your Azure or Google Vision API credentials.',
        'Or revert back to the default built-in scanner.'
      ]
    }
  },
  unknown: {
    retry: true,
    km: {
      title: 'មានបញ្ហាមិនរំពឹងទុក',
      say: 'មានបញ្ហាមួយបានកើតឡើង។ សូមព្យាយាមម្តងទៀត។',
      tips: [
        'ចុច «ព្យាយាមម្តងទៀត» ដើម្បីដំណើរការឡើងវិញ។',
        'ផ្ទុកទំព័រកម្មវិធីឡើងវិញ (Refresh Page)។',
        'សាកល្បងជ្រើសរើសរូបភាពផ្សេងទៀត។'
      ]
    },
    en: {
      title: 'Something Went Wrong',
      say: 'An unexpected issue occurred. Please try again.',
      tips: [
        'Tap "Try Again" to retry.',
        'Refresh the application page.',
        'Try selecting a different image or document.'
      ]
    }
  }
}

/**
 * Get localized error info for a given error kind
 * @param {string} kind
 * @param {'km' | 'en'} lang
 * @returns {{ title: string, say: string, tips: string[], retry: boolean, kind: string }}
 */
export function getScanError(kind, lang = 'km') {
  const entry = SCAN_ERRORS[kind] || SCAN_ERRORS.unknown
  const l = lang === 'en' ? 'en' : 'km'
  const localized = entry[l] || entry.km
  return {
    kind: SCAN_ERRORS[kind] ? kind : 'unknown',
    retry: Boolean(entry.retry),
    title: localized.title,
    say: localized.say,
    tips: Array.isArray(localized.tips) ? localized.tips : []
  }
}

/**
 * Accurately classify any error, with primary priority for offline/network disconnects.
 * @param {any} error
 * @returns {keyof SCAN_ERRORS}
 */
export const classifyScanError = (error) => {
  // 1. Explicit offline flag from browser navigator
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline'
  }

  // 2. Known ScanError kind
  if (error?.kind && SCAN_ERRORS[error.kind]) {
    // If tagged as bad_file or unknown, verify it wasn't actually a masked network failure
    const rawMsg = String(error?.message || '').toLowerCase()
    if (isNetworkErrorMessage(rawMsg)) {
      return 'offline'
    }
    return error.kind
  }

  // 3. Abort / timeout
  if (error?.name === 'AbortError' || /timeout|timed out/i.test(String(error?.message || ''))) {
    return 'slow'
  }

  // 4. Network and offline disconnect patterns
  const msg = String(error?.message || '').toLowerCase()
  if (isNetworkErrorMessage(msg)) {
    return 'offline'
  }

  // 5. Camera hardware/permission errors
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'camera'
  }

  return 'unknown'
}

function isNetworkErrorMessage(msg) {
  return /network request failed|failed to fetch|networkerror|err_internet_disconnected|err_name_not_resolved|err_connection_refused|load failed|offline|disconnected/i.test(msg)
}
