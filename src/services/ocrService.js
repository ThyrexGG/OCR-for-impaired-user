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
import { getFileFingerprint, getOcrCache, setOcrCache } from './cache'
import { t } from './i18n'

class OcrService {
  /**
   * Determine available OCR provider configuration from localStorage and environment
   */
  getProviderConfig() {
    const storedOcrEngine = (typeof window !== 'undefined' && localStorage.getItem('songkhem_ocr_engine')) || 
      (import.meta.env.VITE_AZURE_VISION_API_KEY ? 'azure-read' : (import.meta.env.VITE_GOOGLE_VISION_API_KEY ? 'google-vision' : 'tesseract'))
    const googleApiKey = (typeof window !== 'undefined' && localStorage.getItem('songkhem_google_api_key')) || import.meta.env.VITE_GOOGLE_VISION_API_KEY || ''
    const googleEndpoint = (typeof window !== 'undefined' && localStorage.getItem('songkhem_google_endpoint')) || import.meta.env.VITE_GOOGLE_VISION_ENDPOINT || ''
    const azureApiKey = (typeof window !== 'undefined' && localStorage.getItem('songkhem_azure_vision_key')) || import.meta.env.VITE_AZURE_VISION_API_KEY || ''
    const azureEndpoint = (typeof window !== 'undefined' && localStorage.getItem('songkhem_azure_vision_endpoint')) || import.meta.env.VITE_AZURE_VISION_ENDPOINT || ''

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
      return {
        ok: false,
        error: { message: t('ocrErrorInvalidFile') || 'ឯកសារមិនត្រឹមត្រូវ', code: 'INVALID_FILE' }
      }
    }

    // 1. Check Cache first (Fingerprint match)
    let fingerprint = ''
    try {
      fingerprint = await getFileFingerprint(file)
      const cachedText = getOcrCache(fingerprint)
      if (cachedText) {
        const wordsCount = cachedText.trim().split(/\s+/).filter(Boolean).length
        if (options.onProgress) options.onProgress(100)
        return {
          ok: true,
          data: {
            text: cachedText,
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
      const text = (rawText || '').trim()

      if (!text) {
        return {
          ok: false,
          error: { message: t('ocrErrorNoText') || 'មិនអាចរកឃើញអក្សរក្នុងឯកសារនេះទេ', code: 'NO_TEXT' }
        }
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
      console.error('OCR Extraction Error:', err)
      return {
        ok: false,
        error: {
          message: err.message || t('ocrErrorFailed') || 'មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ',
          code: 'OCR_FAILED'
        }
      }
    }
  }
}

export const ocrService = new OcrService()
