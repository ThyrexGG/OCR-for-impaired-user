import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { CLOUD_API_AVAILABLE, cloudOcr } from './cloudApi'
import { ScanError } from './scanErrors'
import {
  preprocessImageForKhmerOcr,
  postProcessKhmerOcr,
  extractCleanTextFromVisionAnnotation,
  extractCleanTextFromTesseract,
} from './khmerOcrCorrector'

// Configure PDF.js worker for client-side PDF rendering
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
  } catch (e) {
    console.warn('PDF Worker load error:', e)
  }
}

/**
 * Helper to convert file to Base64 string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Split off the data url prefix (e.g. "data:image/png;base64,") to get raw base64
      const base64String = reader.result.split(',')[1]
      resolve(base64String)
    }
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

const MAX_CLOUD_WIDTH = 2400

/**
 * Enhanced Base64 for cloud OCR:
 * Upscales small images (<1500px), normalizes contrast to remove camera shadows,
 * sharpens tiny Khmer Coeng subscripts/diacritics, and fits within serverless limits.
 */
const imageToBase64ForCloud = async (file) => {
  try {
    const { base64 } = await preprocessImageForKhmerOcr(file, {
      maxWidth: MAX_CLOUD_WIDTH,
      minWidth: 1500,
      sharpenAmount: 0.36
    })
    return base64
  } catch {
    return fileToBase64(file)
  }
}

/**
 * Perform text detection using Client-Side Tesseract.js (Khmer + English)
 * Enhanced with Khmer subscript/diacritic pre-processing and orthographic post-correction.
 * @param {File|Blob} fileOrBlob - Selected image or camera capture
 * @param {Function} [onProgress] - Optional progress callback (0-100)
 * @returns {Promise<string>} - Detected text
 */
export const detectTextTesseract = async (fileOrBlob, onProgress) => {
  try {
    const { blob: enhancedBlob } = await preprocessImageForKhmerOcr(fileOrBlob, {
      maxWidth: 2400,
      minWidth: 1600,
      sharpenAmount: 0.42
    })

    const result = await Tesseract.recognize(
      enhancedBlob,
      'khm+eng',
      {
        logger: (m) => {
          if (m && m.status === 'recognizing text' && onProgress && typeof m.progress === 'number') {
            onProgress(Math.round(m.progress * 100))
          }
        }
      }
    )

    const rawText = extractCleanTextFromTesseract(result?.data)
    const text = postProcessKhmerOcr(rawText)
    if (!text || text.length === 0) {
      throw new ScanError('no_text')
    }

    return text
  } catch (error) {
    console.error('Tesseract OCR Execution Error:', error)
    if (error.message && error.message.includes('មិនអាច')) {
      throw error
    }
    throw error instanceof ScanError ? error : new ScanError('bad_file', error.message)
  }
}

/**
 * Extract text from PDF documents (extracts embedded text or renders page 1 to OCR)
 * @param {File} file - PDF file
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {Promise<string>} - Detected text
 */
export const extractTextFromPdf = async (file, onProgress) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages

    let extractedText = ''

    // First attempt: Extract direct digital text stream from pages
    for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) {
      if (onProgress) {
        onProgress(Math.round((pageNum / Math.min(numPages, 10)) * 40))
      }
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ').trim()
      if (pageText) {
        extractedText += pageText + '\n\n'
      }
    }

    if (extractedText.trim().length > 20) {
      if (onProgress) onProgress(100)
      return extractedText.trim()
    }

    // Second attempt: If PDF is scanned image with no embedded text, render pages onto canvas and OCR
    const maxOcrPages = Math.min(numPages, 5)
    let fullOcrText = ''
    for (let pNum = 1; pNum <= maxOcrPages; pNum++) {
      const page = await pdfDoc.getPage(pNum)
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: context, viewport }).promise

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const pageOcr = await detectTextTesseract(blob, (pct) => {
        if (onProgress) {
          const basePct = 20 + Math.round(((pNum - 1) / maxOcrPages) * 80)
          onProgress(Math.min(99, basePct + Math.round((pct / maxOcrPages) * 0.8)))
        }
      })
      if (pageOcr && pageOcr.trim()) {
        fullOcrText += (maxOcrPages > 1 ? `--- ទំព័រទី ${pNum} ---\n` : '') + pageOcr.trim() + '\n\n'
      }
    }
    if (onProgress) onProgress(100)
    return fullOcrText.trim()
  } catch (err) {
    console.error('PDF Extraction Error:', err)
    if (err.message && err.message.includes('មិនអាច')) {
      throw err
    }
    throw new ScanError('bad_file', 'PDF could not be read')
  }
}

/**
 * Perform text detection using Google Cloud Vision API
 * @param {File} file - Selected image or document file
 * @param {string} apiKey - Google Vision API Key
 * @param {string} endpoint - Custom endpoint (optional fallback)
 * @returns {Promise<string>} - Detected text
 */
export const detectTextGoogleVision = async (file, apiKey, endpoint = '') => {
  try {
    if (!apiKey && !CLOUD_API_AVAILABLE) {
      throw new ScanError('settings', 'Google Vision API key missing')
    }

    const base64Image = await imageToBase64ForCloud(file)

    // No personal key: go through songKHEM's own proxy (key stays server-side)
    if (!apiKey) {
      const proxiedText = postProcessKhmerOcr(await cloudOcr(base64Image))
      if (!proxiedText.trim()) {
        throw new ScanError('no_text')
      }
      return proxiedText.trim()
    }

    const baseEndpoint = endpoint || 'https://vision.googleapis.com/v1/images:annotate'
    const url = `${baseEndpoint}?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                model: 'builtin/latest'
              }
            ],
            imageContext: {
              languageHints: ['km', 'en']
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.warn('Google Vision HTTP error:', response.status, errBody)
      throw new ScanError('server', 'Google Vision unreachable')
    }

    const data = await response.json()
    const rawFullText = extractCleanTextFromVisionAnnotation(data.responses?.[0]?.fullTextAnnotation)
    const fullText = postProcessKhmerOcr(rawFullText)

    if (!fullText || !fullText.trim()) {
      throw new ScanError('no_text')
    }

    return fullText.trim()
  } catch (error) {
    console.error('Google Vision OCR API Execution Error:', error)
    throw error
  }
}

/**
 * Perform text detection using Microsoft Azure Computer Vision (Image Analysis 4.0)
 * @param {File} file - Selected image or document file
 * @param {string} apiKey - Azure Subscription Key
 * @param {string} endpoint - Azure Cognitive Services Endpoint
 * @returns {Promise<string>} - Detected text
 */
export const detectTextAzureVision = async (file, apiKey, endpoint) => {
  try {
    if (!apiKey) {
      throw new ScanError('settings', 'Azure Vision key missing')
    }
    if (!endpoint) {
      throw new ScanError('settings', 'Azure Vision endpoint missing')
    }

    // Ensure endpoint doesn't end with a slash
    const baseEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
    const url = `${baseEndpoint}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=read`

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: arrayBuffer
    })

    if (!response.ok) {
      throw new ScanError('server', 'Azure Vision unreachable')
    }

    const data = await response.json()

    if (!data.readResult || !data.readResult.blocks) {
      throw new ScanError('no_text')
    }

    // Extract text from blocks while preserving paragraph lines
    let fullText = ''
    for (const block of data.readResult.blocks) {
      for (const line of block.lines) {
        fullText += line.text + '\n'
      }
      fullText += '\n'
    }

    const trimmed = postProcessKhmerOcr(fullText)
    if (!trimmed) {
      throw new ScanError('no_text')
    }

    return trimmed
  } catch (error) {
    console.error('Azure OCR API Execution Error:', error)
    throw error
  }
}

/**
 * Unified document text extraction engine
 * Dispatches to the appropriate OCR service (Tesseract, Google Vision, Azure) or PDF parser.
 * Always returns true extracted text or throws an error. NEVER silently falls back to sample mock datasets.
 * 
 * @param {File} file
 * @param {Object} config
 * @param {Function} [onProgress]
 * @returns {Promise<string>}
 */
export const extractDocumentText = async (file, config = {}, onProgress) => {
  if (!file) {
    throw new ScanError('bad_file', 'No file selected')
  }

  const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'))
  if (isPdf) {
    const pdfText = await extractTextFromPdf(file, onProgress)
    return postProcessKhmerOcr(pdfText)
  }

  const provider = config.provider || 'tesseract'

  if (provider === 'google-vision') {
    try {
      return await detectTextGoogleVision(file, config.googleApiKey, config.googleEndpoint)
    } catch (gvErr) {
      // If cloud Google Vision is unconfigured or unreachable, seamlessly fall back to enhanced Khmer Tesseract
      console.warn('Google Vision unavailable, falling back to enhanced Khmer Tesseract:', gvErr?.message)
      return await detectTextTesseract(file, onProgress)
    }
  }

  if (provider === 'azure-read') {
    return await detectTextAzureVision(file, config.azureApiKey, config.azureEndpoint)
  }

  // Default provider: Enhanced Client-side Khmer+English Tesseract
  return await detectTextTesseract(file, onProgress)
}
