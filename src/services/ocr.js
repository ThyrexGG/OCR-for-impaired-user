import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

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

/**
 * Perform text detection using Client-Side Tesseract.js (Khmer + English)
 * Free, offline capable, runs directly inside the user's browser.
 * @param {File|Blob} fileOrBlob - Selected image or camera capture
 * @param {Function} [onProgress] - Optional progress callback (0-100)
 * @returns {Promise<string>} - Detected text
 */
export const detectTextTesseract = async (fileOrBlob, onProgress) => {
  try {
    const result = await Tesseract.recognize(
      fileOrBlob,
      'khm+eng',
      {
        logger: (m) => {
          if (m && m.status === 'recognizing text' && onProgress && typeof m.progress === 'number') {
            onProgress(Math.round(m.progress * 100))
          }
        }
      }
    )

    const text = result?.data?.text ? result.data.text.trim() : ''
    if (!text || text.length === 0) {
      throw new Error('មិនអាចរកឃើញអក្សរច្បាស់លាស់ក្នុងរូបភាពនេះទេ។ សូមព្យាយាមថតនៅកន្លែងមានពន្លឺគ្រប់គ្រាន់ ឬកាន់កាមេរ៉ាឱ្យកៀកជាងមុន។ (No readable text was detected by OCR. Try better lighting or hold the camera closer.)')
    }

    return text
  } catch (error) {
    console.error('Tesseract OCR Execution Error:', error)
    if (error.message && error.message.includes('មិនអាច')) {
      throw error
    }
    throw new Error(`មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ៖ ${error.message || 'សូមព្យាយាមស្កេនម្តងទៀត'}`)
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

    // Second attempt: If PDF is scanned image with no embedded text, render page 1 onto canvas and OCR
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: context, viewport }).promise

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    return await detectTextTesseract(blob, (pct) => {
      if (onProgress) onProgress(40 + Math.round(pct * 0.6))
    })
  } catch (err) {
    console.error('PDF Extraction Error:', err)
    if (err.message && err.message.includes('មិនអាច')) {
      throw err
    }
    throw new Error('មិនអាចស្រង់អត្ថបទពីឯកសារ PDF នេះបានទេ។ សូមពិនិត្យឯកសារ ហើយព្យាយាមម្តងទៀត។')
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
    if (!apiKey) {
      throw new Error('សូមបញ្ចូល Google Cloud Vision API Key ក្នុងផ្ទាំងការកំណត់ជាមុនសិន។ (Please configure your Google Vision API Key in Settings.)')
    }

    const base64Image = await fileToBase64(file)
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
                type: 'DOCUMENT_TEXT_DETECTION' // Optimize for dense page texts (PDF/paper scans)
              }
            ],
            imageContext: {
              languageHints: ['km', 'en'] // Guide the engine for both Khmer script and English
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.warn('Google Vision HTTP error:', response.status, errBody)
      throw new Error('មិនអាចទាក់ទងម៉ាស៊ីនស្កេន Google Vision បានទេ។ សូមពិនិត្យ API Key និងការតភ្ជាប់អ៊ីនធឺណិត។ (Unable to connect to Google Vision OCR service. Check your API key.)')
    }

    const data = await response.json()
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText || !fullText.trim()) {
      throw new Error('មិនអាចរកឃើញអក្សរច្បាស់លាស់ក្នុងឯកសារនេះទេ។ សូមព្យាយាមថតនៅកន្លែងមានពន្លឺគ្រប់គ្រាន់ ឬកាន់កាមេរ៉ាឱ្យកៀកជាងមុន។ (No readable text was detected. Try better lighting or hold the camera closer.)')
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
      throw new Error('សូមបញ្ចូល Azure Computer Vision Key ក្នុងផ្ទាំងការកំណត់ជាមុនសិន។ (Please configure your Azure Vision Key in Settings.)')
    }
    if (!endpoint) {
      throw new Error('សូមបញ្ចូល Azure Vision Endpoint ក្នុងផ្ទាំងការកំណត់ជាមុនសិន។ (Azure Vision endpoint is required.)')
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
      throw new Error('មិនអាចទាក់ទងម៉ាស៊ីនស្កេន Azure បានទេ។ សូមពិនិត្យ Subscription Key និងការតភ្ជាប់អ៊ីនធឺណិត។ (Unable to connect to Azure OCR service.)')
    }

    const data = await response.json()

    if (!data.readResult || !data.readResult.blocks) {
      throw new Error('មិនអាចរកឃើញអក្សរក្នុងឯកសារនេះទេ។ សូមពិនិត្យពន្លឺ និងតម្រង់កាមេរ៉ាឱ្យចំអត្ថបទ។ (No readable text was detected.)')
    }

    // Extract text from blocks while preserving paragraph lines
    let fullText = ''
    for (const block of data.readResult.blocks) {
      for (const line of block.lines) {
        fullText += line.text + '\n'
      }
      fullText += '\n'
    }

    const trimmed = fullText.trim()
    if (!trimmed) {
      throw new Error('មិនអាចរកឃើញអក្សរក្នុងឯកសារនេះទេ។ សូមព្យាយាមស្កេនម្តងទៀត។')
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
    throw new Error('សូមជ្រើសរើសឯកសារ ឬថតរូបភាពជាមុនសិន។')
  }

  const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'))
  if (isPdf) {
    return await extractTextFromPdf(file, onProgress)
  }

  const provider = config.provider || 'tesseract'

  if (provider === 'google-vision') {
    return await detectTextGoogleVision(file, config.googleApiKey, config.googleEndpoint)
  }

  if (provider === 'azure-read') {
    return await detectTextAzureVision(file, config.azureApiKey, config.azureEndpoint)
  }

  // Default provider: Client-side in-browser Tesseract (Free, works offline, no API key required)
  return await detectTextTesseract(file, onProgress)
}
