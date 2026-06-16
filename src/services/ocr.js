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
 * Perform text detection using Google Cloud Vision API
 * @param {File} file - Selected image or document file
 * @param {string} apiKey - Google Vision API Key
 * @param {string} endpoint - Custom endpoint (optional fallback)
 * @returns {Promise<string>} - Detected text
 */
export const detectTextGoogleVision = async (file, apiKey, endpoint = '') => {
  try {
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
              languageHints: ['km'] // Guide the engine specifically for Khmer script
            }
          }
        ]
      })
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.error?.message || 'Failed to communicate with Google Vision API')
    }

    const data = await response.json()
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText) {
      throw new Error('No Khmer text was detected in the uploaded document.')
    }

    return fullText
  } catch (error) {
    console.error('OCR API Execution Error:', error)
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
    if (!endpoint) {
      throw new Error('Azure Vision endpoint is required')
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
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error?.message || 'Failed to communicate with Azure Vision API')
    }

    const data = await response.json()

    if (!data.readResult || !data.readResult.blocks) {
      throw new Error('No text was detected in the uploaded document.')
    }

    // Extract text from blocks
    let fullText = ''
    for (const block of data.readResult.blocks) {
      for (const line of block.lines) {
        fullText += line.text + '\n'
      }
    }

    return fullText.trim()
  } catch (error) {
    console.error('Azure OCR API Execution Error:', error)
    throw error
  }
}
