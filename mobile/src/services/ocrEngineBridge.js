// Promise API over the hidden WebView in OcrEngineHost, which runs the same
// Tesseract.js (khm+eng) + pdf.js engine the web app uses by default. The
// host registers its postMessage sender here once mounted; callers await
// recognizeInEngine() and get progress callbacks as the page reports them.

let sender = null
let isReady = false
let readyWaiters = []
const pending = new Map()
let jobCounter = 0

export function registerEngineSender(fn) {
  sender = fn
  if (!fn) {
    isReady = false
    for (const [, job] of pending) job.reject(new Error('ម៉ាស៊ីនស្កេនត្រូវបានបិទ។ សូមព្យាយាមម្តងទៀត។'))
    pending.clear()
  }
}

export function markEngineReady() {
  isReady = true
  readyWaiters.forEach((w) => w())
  readyWaiters = []
}

function waitUntilReady(timeoutMs) {
  if (isReady) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      readyWaiters = readyWaiters.filter((w) => w !== done)
      reject(new Error('មិនអាចបើកម៉ាស៊ីនស្កេនបានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។'))
    }, timeoutMs)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    readyWaiters.push(done)
  })
}

export function handleEngineMessage(raw) {
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  if (msg.type === 'ready') {
    markEngineReady()
    return
  }
  const job = pending.get(msg.id)
  if (!job) return
  if (msg.type === 'progress') {
    job.onProgress?.(msg.value)
  } else if (msg.type === 'result') {
    pending.delete(msg.id)
    job.resolve(msg.text)
  } else if (msg.type === 'error') {
    pending.delete(msg.id)
    job.reject(new Error(msg.message))
  }
}

/**
 * @param {{ base64: string, mimeType: string, onProgress?: (pct:number)=>void }} input
 * @returns {Promise<string>} extracted text (throws with a Khmer message on failure)
 */
export async function recognizeInEngine({ base64, mimeType, onProgress }) {
  await waitUntilReady(20000)
  if (!sender) throw new Error('ម៉ាស៊ីនស្កេនមិនទាន់រួចរាល់។ សូមព្យាយាមម្តងទៀត។')
  const id = ++jobCounter
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress })
    sender(JSON.stringify({ type: 'recognize', id, base64, mimeType }))
  })
}
