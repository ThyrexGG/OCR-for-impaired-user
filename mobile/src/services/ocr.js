/**
 * songKHEM OCR Service (React Native port of src/services/ocr.js)
 * `file` here is a picked/captured file object: { uri, name, mimeType }
 * (from expo-camera / expo-document-picker), not a web File/Blob.
 */
import { Image } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { recognizeInEngine } from './ocrEngineBridge'
import { cloudOcr } from './cloudApi'

/**
 * Read a local file URI as a raw Base64 string (no data-url prefix).
 */
export const fileToBase64 = async (file) => {
  return FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 })
}

const MAX_OCR_WIDTH = 2000
const MAX_CLOUD_WIDTH = 2400

const getImageSize = (uri) =>
  new Promise((resolve) => Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null)))

/**
 * Client-side Tesseract.js (khm+eng) — the web app's default, keyless engine,
 * run in the hidden OcrEngineHost WebView. PDFs go through its pdf.js path
 * (embedded text first, else OCR of page 1), exactly like the web's
 * extractDocumentText(). Camera photos are downscaled to ≤2000px wide first:
 * a full-res 12MP JPEG is slow to pass across the bridge and to recognize,
 * and gains nothing for document text.
 */
export const detectTextOnDevice = async (file, onProgress) => {
  const isPdf = file.mimeType === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')
  if (isPdf) {
    const base64 = await fileToBase64(file)
    return recognizeInEngine({ base64, mimeType: 'application/pdf', onProgress })
  }

  const base64 = await imageToJpegBase64(file, MAX_OCR_WIDTH)
  return recognizeInEngine({ base64, mimeType: 'image/jpeg', onProgress })
}

const imageToJpegBase64 = async (file, maxWidth) => {
  const size = await getImageSize(file.uri)
  const actions = size && size.width > maxWidth ? [{ resize: { width: maxWidth } }] : []
  const prepared = await manipulateAsync(file.uri, actions, { compress: 0.9, format: SaveFormat.JPEG, base64: true })
  return prepared.base64
}

/**
 * Perform text detection using Google Cloud Vision API
 * @param {{uri:string,name?:string,mimeType?:string}} file
 * @param {string} apiKey - Google Vision API Key
 * @param {string} endpoint - Custom endpoint (optional fallback)
 * @returns {Promise<string>} - Detected text
 */
export const detectTextGoogleVision = async (file, apiKey, endpoint = '') => {
  try {
    // ≤2400px JPEG keeps full-res photos under the proxy's 4.5MB request limit
    const base64Image = await imageToJpegBase64(file, MAX_CLOUD_WIDTH)

    // No personal key: go through songKHEM's api/ocr proxy (key stays server-side)
    if (!apiKey) {
      const proxiedText = (await cloudOcr(base64Image)).trim()
      if (!proxiedText) {
        throw new Error(
          'មិនអាចរកឃើញអក្សរច្បាស់លាស់ក្នុងឯកសារនេះទេ។ សូមព្យាយាមថតនៅកន្លែងមានពន្លឺគ្រប់គ្រាន់ ឬកាន់កាមេរ៉ាឱ្យកៀកជាងមុន។ (No readable text was detected. Try better lighting or hold the camera closer.)'
        )
      }
      return proxiedText
    }

    const baseEndpoint = endpoint || 'https://vision.googleapis.com/v1/images:annotate'
    const url = `${baseEndpoint}?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
              },
            ],
            imageContext: {
              languageHints: ['km', 'en'],
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(
        'មិនអាចទាក់ទងម៉ាស៊ីនស្កេនបានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។ (Unable to connect to OCR service. Please check your network and try again.)'
      )
    }

    const data = await response.json()
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText || !fullText.trim()) {
      throw new Error(
        'មិនអាចរកឃើញអក្សរច្បាស់លាស់ក្នុងឯកសារនេះទេ។ សូមព្យាយាមថតនៅកន្លែងមានពន្លឺគ្រប់គ្រាន់ ឬកាន់កាមេរ៉ាឱ្យកៀកជាងមុន។ (No readable text was detected. Try better lighting or hold the camera closer.)'
      )
    }

    return fullText.trim()
  } catch (error) {
    console.error('OCR API Execution Error:', error)
    throw error
  }
}

/**
 * Perform text detection using Microsoft Azure Computer Vision (Image Analysis 4.0)
 * @param {{uri:string,name?:string,mimeType?:string}} file
 * @param {string} apiKey - Azure Subscription Key
 * @param {string} endpoint - Azure Cognitive Services Endpoint
 * @returns {Promise<string>} - Detected text
 */
export const detectTextAzureVision = async (file, apiKey, endpoint) => {
  try {
    if (!endpoint) {
      throw new Error('Azure Vision endpoint is required')
    }

    const baseEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
    const url = `${baseEndpoint}/computervision/imageanalysis:analyze?api-version=2023-10-01&features=read`

    // RN's fetch can read a local file:// uri into a Blob directly, used as the request body.
    const fileResponse = await fetch(file.uri)
    const blob = await fileResponse.blob()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    })

    if (!response.ok) {
      throw new Error('មិនអាចទាក់ទងម៉ាស៊ីនស្កេន Azure បានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត។ (Unable to connect to Azure OCR service.)')
    }

    const data = await response.json()

    if (!data.readResult || !data.readResult.blocks) {
      throw new Error('មិនអាចរកឃើញអក្សរក្នុងឯកសារនេះទេ។ សូមពិនិត្យពន្លឺ និងតម្រង់កាមេរ៉ាឱ្យចំអត្ថបទ។ (No readable text was detected.)')
    }

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
