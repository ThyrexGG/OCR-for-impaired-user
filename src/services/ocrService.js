/**
 * OCR Recognition Service (Port & Strategy Adapter)
 * Conforms to .agents/ProjectInstruction.md §5.2 & §5.7
 * 
 * SOLID Principles applied:
 * - Single Responsibility: Coordinates recognition, caching, and engine selection.
 * - Dependency Inversion: UI depends on this abstract service, not concrete Vision SDKs.
 * - Open/Closed: Concrete providers plug in via extractDocumentText.
 * 
 * Note: Never silently falls back to mock sample datasets. 
 * Real OCR errors are preserved and honestly reported to the user.
 */

import { extractDocumentText } from './ocr'
import { postProcessKhmerOcr } from './khmerOcrCorrector'
import { getFileFingerprint, getOcrCache, setOcrCache } from './cache'
import { CLOUD_API_AVAILABLE } from './cloudApi'
import { t } from './i18n'
import { SCAN_ERRORS, classifyScanError } from './scanErrors'

// What went wrong and what to do, in plain words (same list as the app); `kind` lets the screen speak it
const scanFailure = (kind) => ({
  ok: false,
  error: { kind, code: kind, title: SCAN_ERRORS[kind].title, say: SCAN_ERRORS[kind].say, message: `${SCAN_ERRORS[kind].title}។ ${SCAN_ERRORS[kind].say}` }
})

const USER_ENGINE_SETTINGS = false

class OcrService {
  /**
   * Determine available OCR provider configuration from localStorage and environment
   */
  getProviderConfig() {
    // Same as the app: Settings no longer offers a scan engine or keys, so saved ones are ignored and every
    // scan goes through the api/ocr proxy (Google Vision). true brings the user's own choice back.
    if (!USER_ENGINE_SETTINGS && CLOUD_API_AVAILABLE) {
      return { provider: 'google-vision', googleApiKey: '', googleEndpoint: '', azureApiKey: '', azureEndpoint: '' }
    }
    // Keys come only from the user's own Settings entries. With none, Google
    // Vision runs through the api/ocr serverless proxy (keys stay server-side).
    const storedOcrEngine = (typeof window !== 'undefined' && localStorage.getItem('songkhem_ocr_engine')) ||
      (CLOUD_API_AVAILABLE ? 'google-vision' : 'tesseract')
    const googleApiKey = (typeof window !== 'undefined' && localStorage.getItem('songkhem_google_api_key')) || ''
    const googleEndpoint = (typeof window !== 'undefined' && localStorage.getItem('songkhem_google_endpoint')) || ''
    const azureApiKey = (typeof window !== 'undefined' && localStorage.getItem('songkhem_azure_vision_key')) || ''
    const azureEndpoint = (typeof window !== 'undefined' && localStorage.getItem('songkhem_azure_vision_endpoint')) || ''

    return {
      provider: storedOcrEngine,
      googleApiKey,
      googleEndpoint,
      azureApiKey,
      azureEndpoint
    }
  }

  /**
   * Recognize text from an image or document file
   * @param {File} file
   * @param {Object} options - e.g. { onProgress }
   * @returns {Promise<{ ok: true, data: { text: string, cached: boolean, wordsCount: number, fingerprint: string } } | { ok: false, error: { message: string, code: string } }>}
   */
  async recognize(file, options = {}) {
    if (!file) {
      return scanFailure('bad_file')
    }

    // 1. Check Cache first (Fingerprint match)
    let fingerprint = ''
    try {
      fingerprint = await getFileFingerprint(file)
      const cachedText = getOcrCache(fingerprint)
      if (cachedText) {
        const refinedCached = postProcessKhmerOcr(cachedText)
        const wordsCount = refinedCached.trim().split(/\s+/).filter(Boolean).length
        if (options.onProgress) options.onProgress(100)
        return {
          ok: true,
          data: {
            text: refinedCached,
            cached: true,
            wordsCount,
            fingerprint
          }
        }
      }
    } catch {
      // Proceed without cache
    }

    // 2. Execute via configured Provider (Tesseract / Azure / Google / PDF)
    const config = this.getProviderConfig()

    try {
      const rawText = await extractDocumentText(file, config, options.onProgress)
      const text = postProcessKhmerOcr((rawText || '').trim())

      if (!text) {
        return scanFailure('no_text')
      }

      // 3. Cache Result
      if (fingerprint) {
        setOcrCache(fingerprint, text, file.name)
      }

      const wordsCount = text.split(/\s+/).filter(Boolean).length
      return {
        ok: true,
        data: {
          text,
          cached: false,
          wordsCount,
          fingerprint
        }
      }
    } catch (err) {
      const kind = classifyScanError(err)
      console.warn(`Scan failed (${kind}): ${SCAN_ERRORS[kind].en}`, err?.message)
      return scanFailure(kind)
    }
  }
}

export const ocrService = new OcrService()
