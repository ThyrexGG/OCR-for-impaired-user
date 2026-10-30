import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useApp } from './AppContext'
import { detectTextGoogleVision, detectTextAzureVision, detectTextOnDevice } from '../services/ocr'
import { getFileFingerprint, getOcrCache, setOcrCache } from '../services/cache'
import { CLOUD_API_AVAILABLE } from '../services/cloudApi'
import { sampleLibrary } from '../services/sampleLibrary'
import { navigateToReader } from '../navigation/navigationRef'
import { TP } from '../services/talkPhrases'
import { stopSpeaking } from '../services/talkback'
import { startWaitingCue, stopWaitingCue } from '../services/waitingCue'
import { SCAN_ERRORS, ScanError, classifyScanError } from '../services/scanErrors'

const HISTORY_STORAGE_KEY = 'songkhem_history'
const MAX_HISTORY_ITEMS = 25

const wordCount = (text) => text.trim().split(/\s+/).filter((w) => w.length > 0).length

const OcrContext = createContext(null)

export function OcrProvider({ children }) {
  const { triggerHaptic, speakAccessibility, addToast, isAutoReadEnabled, ocrConfig } = useApp()

  const [selectedFile, setSelectedFile] = useState(null) // { uri, name, mimeType, kind }
  const [previewUri, setPreviewUri] = useState(null) // image uri | 'pdf' | null
  const [selectedFileName, setSelectedFileName] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLongProcessing, setIsLongProcessing] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [ocrError, setOcrError] = useState(null) // a SCAN_ERRORS kind, e.g. 'offline'
  const [ocrProgress, setOcrProgress] = useState(0)

  const processingTimeoutRef = useRef(null)
  const processingTickRef = useRef(null)

  // While a scan runs, the waiting cue loops (with a light tick now and then): a user who cannot see
  // the spinner has no other way to tell "working" from "stuck".
  const clearProcessingTimers = useCallback(() => {
    stopWaitingCue()
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current)
    if (processingTickRef.current) clearInterval(processingTickRef.current)
    processingTimeoutRef.current = null
    processingTickRef.current = null
  }, [])
  const autoReadHandlerRef = useRef(null)

  const setAutoReadHandler = useCallback((fn) => {
    autoReadHandlerRef.current = fn
  }, [])

  const maybeAutoRead = useCallback(
    (delay = 400) => {
      if (isAutoReadEnabled && autoReadHandlerRef.current) {
        setTimeout(() => autoReadHandlerRef.current?.(), delay)
      }
    },
    [isAutoReadEnabled]
  )

  // --- History persistence ---
  const saveHistory = useCallback((list) => {
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list)).catch((err) =>
      console.error('History save error:', err)
    )
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await AsyncStorage.getItem(HISTORY_STORAGE_KEY)
        if (saved) {
          setHistoryList(JSON.parse(saved))
        } else {
          const seeded = [
            {
              id: 1,
              name: 'សេចក្តីជូនដំណឹង_ក្រសួង.pdf',
              text: sampleLibrary[0].text,
              timestamp: '10:30 AM',
              date: 'ថ្ងៃនេះ',
              wordsCount: 42,
            },
            {
              id: 2,
              name: 'រឿងព្រេង_ធនញ្ជ័យ.jpg',
              text: sampleLibrary[1].text,
              timestamp: 'ម្សិលមិញ',
              date: 'ម្សិលមិញ',
              wordsCount: 38,
            },
          ]
          setHistoryList(seeded)
          saveHistory(seeded)
        }
      } catch (e) {
        console.warn('Could not load history:', e)
      }
    })()
  }, [saveHistory])

  const addToHistory = useCallback(
    (name, text, cached = false) => {
      if (!text || !text.trim()) return
      setHistoryList((prev) => {
        if (prev.length > 0 && prev[0].text === text) return prev
        const now = new Date()
        const entry = {
          id: Date.now(),
          name: name || 'ឯកសារស្កេនថ្មី',
          text: text.trim(),
          timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: now.toLocaleDateString('km-KH', { month: 'short', day: 'numeric' }),
          wordsCount: wordCount(text),
          cached,
        }
        const next = [entry, ...prev].slice(0, MAX_HISTORY_ITEMS)
        saveHistory(next)
        return next
      })
    },
    [saveHistory]
  )

  // --- Shared OCR execution body. Takes the file explicitly (rather than
  // reading it back from state) so the camera's "capture -> scan immediately"
  // flow doesn't race React's async state updates.
  // Resolves true on success, or the failure's SCAN_ERRORS kind. quietNoText: the caller has a
  // second photo to try, so "no text" is not announced yet. ---
  const runOcrFlow = useCallback(
    async (file, fileName, { quietNoText = false } = {}) => {
      let fingerprint = ''
      let cachedText = null
      try {
        fingerprint = file?.uri ? await getFileFingerprint(file) : ''
        cachedText = fingerprint ? await getOcrCache(fingerprint) : null
      } catch {
        // Proceed without cache (same as ocrService.recognize on the web).
      }

      if (cachedText) {
        setExtractedText(cachedText)
        setIsCached(true)
        addToHistory(fileName, cachedText, true)
        addToast('ផ្ទុកអត្ថបទពី Cache ភ្លាមៗ (Instant Hit)', 'cache')
        triggerHaptic('success')
        speakAccessibility('បានស្កេន និងស្រង់អត្ថបទពី Cache ភ្លាមៗរួចរាល់')
        navigateToReader()
        maybeAutoRead(300)
        return true
      }

      setIsCached(false)
      setIsProcessing(true)
      setOcrError(null)
      setOcrProgress(0)
      triggerHaptic('medium')

      // No words while it works: the du-du-du cue says "still working" until the result is spoken
      clearProcessingTimers()
      stopSpeaking()
      startWaitingCue()
      processingTimeoutRef.current = setTimeout(() => {
        setIsLongProcessing(true)
        processingTickRef.current = setInterval(() => triggerHaptic('light'), 9000)
      }, 5000)

      const pendingId = 'pending_' + Date.now()
      setHistoryList((prev) => [
        { id: pendingId, name: fileName || 'ឯកសារកំពុងស្កេន...', pending: true, timestamp: 'កំពុងស្កេន...', date: 'ថ្ងៃនេះ' },
        ...prev,
      ])

      const finalizeOcr = (resultText) => {
        clearProcessingTimers()
        setIsLongProcessing(false)
        setExtractedText(resultText)
        if (fingerprint) setOcrCache(fingerprint, resultText, fileName)

        setHistoryList((prev) => {
          const finalizedItem = {
            id: Date.now(),
            name: fileName || 'ឯកសារស្កេនថ្មី',
            text: resultText.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: 'ថ្ងៃនេះ',
            wordsCount: wordCount(resultText),
          }
          const idx = prev.findIndex((i) => i.id === pendingId)
          const next = idx !== -1 ? [...prev.slice(0, idx), finalizedItem, ...prev.slice(idx + 1)] : [finalizedItem, ...prev]
          saveHistory(next)
          return next
        })

        setIsProcessing(false)
        setOcrProgress(100)
        triggerHaptic('success')
        addToast('ស្កេនស្រង់អត្ថបទជោគជ័យ', 'success')
        speakAccessibility(['ស្កេនស្រង់អត្ថបទជោគជ័យ', `${wordCount(resultText)} ${TP.wordUnit.km}`])
        navigateToReader()
        maybeAutoRead()
      }

      // Same resolution as the web's OcrService.getProviderConfig(): a saved
      // Settings choice, else Google Vision via the api/ocr proxy when the
      // build has an API base URL, else the free on-device Tesseract.js.
      // Keys are only ever the user's own Settings entries.
      const googleKey = ocrConfig.googleApiKey || ''
      const googleEndpoint = ocrConfig.googleEndpoint || ''
      const azureKey = ocrConfig.azureVisionKey || ''
      const azureEndpoint = ocrConfig.azureVisionEndpoint || ''
      const provider = ocrConfig.provider || (CLOUD_API_AVAILABLE ? 'google-vision' : 'tesseract')
      const isPdf = file?.mimeType === 'application/pdf' || (file?.name || '').toLowerCase().endsWith('.pdf')

      try {
        if (!file?.uri) throw new ScanError('bad_file', 'No file selected')
        let text
        if (isPdf || provider === 'tesseract') {
          text = await detectTextOnDevice(file, setOcrProgress)
        } else if (provider === 'google-vision') {
          if (!googleKey && !CLOUD_API_AVAILABLE) throw new ScanError('settings', 'Google Vision API key missing')
          text = await detectTextGoogleVision(file, googleKey, googleEndpoint)
        } else {
          if (!azureKey) throw new ScanError('settings', 'Azure Vision key missing')
          if (!azureEndpoint) throw new ScanError('settings', 'Azure Vision endpoint missing')
          text = await detectTextAzureVision(file, azureKey, azureEndpoint)
        }
        text = (text || '').trim()
        if (!text) throw new ScanError('no_text')
        finalizeOcr(text)
        return true
      } catch (error) {
        const kind = classifyScanError(error)
        console.warn(`Scan failed (${kind}): ${SCAN_ERRORS[kind].en}`, error?.message)
        clearProcessingTimers()
        setIsProcessing(false)
        setIsLongProcessing(false)
        setOcrProgress(0)
        setHistoryList((prev) => prev.filter((i) => i.id !== pendingId))
        if (quietNoText && kind === 'no_text') return kind
        triggerHaptic('error')
        setOcrError(kind)
        // What went wrong, then what to do, each sentence on its own so all of it comes from the voice pack
        const { title, say } = SCAN_ERRORS[kind]
        speakAccessibility([title, ...say.split('។').map((part) => part.trim()).filter(Boolean)])
        return kind
      }
    },
    [addToHistory, addToast, triggerHaptic, speakAccessibility, saveHistory, maybeAutoRead, ocrConfig, clearProcessingTimers]
  )

  // --- File selection (Upload tab) ---
  const setFile = useCallback(
    (file) => {
      // file: { uri, name, mimeType }
      const isImage = (file.mimeType || '').startsWith('image/')
      const isPdf = file.mimeType === 'application/pdf'

      if (!isImage && !isPdf) {
        speakAccessibility('ទម្រង់ឯកសារមិនត្រឹមត្រូវ សូមជ្រើសរើសរូបភាព ឬ PDF')
        return
      }

      setSelectedFile({ ...file, kind: isImage ? 'image' : 'pdf', source: 'upload' })
      setSelectedFileName(file.name || '')
      setExtractedText('')
      setIsCached(false)
      setOcrError(null)
      setPreviewUri(isImage ? file.uri : 'pdf')
      triggerHaptic('light')
      addToast(`បានផ្ទុកឯកសារ ${file.name} រួចរាល់។ ចុចស្កេន និងអាន។`, 'info')
    },
    [speakAccessibility, triggerHaptic, addToast]
  )

  const clearFile = useCallback(() => {
    clearProcessingTimers()
    setSelectedFile(null)
    setPreviewUri(null)
    setSelectedFileName('')
    setExtractedText('')
    setIsCached(false)
    setIsProcessing(false)
    setOcrError(null)
    triggerHaptic('light')
    speakAccessibility('បានសម្អាតឯកសារ')
  }, [triggerHaptic, speakAccessibility, clearProcessingTimers])

  // --- Camera capture: sets the file AND immediately runs OCR on it,
  // passing the file explicitly to runOcrFlow instead of relying on state
  // that wouldn't have flushed yet within the same handler. ---
  const captureAndScan = useCallback(
    (file, options) => {
      const name = file.name || `scan_${Date.now()}.jpg`
      setSelectedFile({ ...file, name, kind: 'image', source: 'camera' })
      setSelectedFileName(name)
      setPreviewUri(file.uri)
      setExtractedText('')
      setIsCached(false)
      setOcrError(null)
      triggerHaptic('success')
      return runOcrFlow({ ...file, name }, name, options)
    },
    [runOcrFlow, triggerHaptic]
  )

  // --- OCR trigger (Upload tab's "Extract Text" button) ---
  const triggerOcr = useCallback(() => {
    if (isProcessing || !selectedFile) return
    return runOcrFlow(selectedFile, selectedFileName)
  }, [isProcessing, selectedFile, selectedFileName, runOcrFlow])

  // --- Sample library ---
  const loadSample = useCallback(
    (sample) => {
      setSelectedFileName(`${sample.title}.txt`)
      setSelectedFile({ uri: null, name: `${sample.id}.txt`, mimeType: 'text/plain', kind: 'text' })
      setPreviewUri(null)
      setExtractedText(sample.text)
      setIsCached(true)
      setOcrError(null)
      addToHistory(sample.title, sample.text, true)
      triggerHaptic('success')
      addToast(`បានផ្ទុកគំរូ "${sample.title}"`, 'info')
      speakAccessibility(`បានផ្ទុកគំរូ ${sample.title} ជោគជ័យ។ ចូលទៅផ្ទាំងអាន។`)
      navigateToReader()
      maybeAutoRead()
    },
    [addToHistory, triggerHaptic, addToast, speakAccessibility, maybeAutoRead]
  )

  // The guided tour opens a sample without the toast, voice, navigation or auto-read that loadSample adds
  const openSampleQuietly = useCallback(
    (sample) => {
      setSelectedFileName(sample.title + '.txt')
      setSelectedFile({ uri: null, name: sample.id + '.txt', mimeType: 'text/plain', kind: 'text' })
      setPreviewUri(null)
      setExtractedText(sample.text)
      setIsCached(true)
      setOcrError(null)
      addToHistory(sample.title, sample.text, true)
    },
    [addToHistory]
  )

  // Undo openSampleQuietly once the tour is over: drop what it added to the history and close the document
  const discardTourSample = useCallback(
    (keepIds) => {
      const keep = new Set(keepIds)
      setHistoryList((prev) => {
        const next = prev.filter((i) => keep.has(i.id))
        if (next.length !== prev.length) saveHistory(next)
        return next
      })
      setSelectedFile(null)
      setSelectedFileName('')
      setPreviewUri(null)
      setExtractedText('')
      setIsCached(false)
    },
    [saveHistory]
  )

  // --- History actions ---
  const loadHistoryItem = useCallback(
    (item) => {
      setSelectedFileName(item.name)
      setExtractedText(item.text)
      setIsCached(!!item.cached)
      addToast(`បានផ្ទុក "${item.name}"`, 'info')
      navigateToReader()
    },
    [addToast]
  )

  const quickPlayHistoryItem = useCallback(
    (item) => {
      setSelectedFileName(item.name)
      setExtractedText(item.text)
      setIsCached(!!item.cached)
      addToast(`ចាប់ផ្តើមអាន "${item.name}"`, 'info')
      navigateToReader()
      maybeAutoRead(300)
    },
    [addToast, maybeAutoRead]
  )

  const renameHistoryItem = useCallback(
    (id, newName) => {
      const trimmed = (newName || '').trim()
      if (!trimmed) return
      setHistoryList((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, name: trimmed } : i))
        saveHistory(next)
        return next
      })
      speakAccessibility(`បានប្តូរឈ្មោះឯកសារទៅជា ${trimmed}`)
    },
    [saveHistory, speakAccessibility]
  )

  const deleteHistoryItem = useCallback(
    (id) => {
      setHistoryList((prev) => {
        const idx = prev.findIndex((i) => i.id === id)
        if (idx === -1) return prev
        const deletedItem = prev[idx]
        const next = prev.filter((i) => i.id !== id)
        saveHistory(next)

        addToast(`បានលុប "${deletedItem.name}"`, 'warning', {
          actionLabel: 'មិនធ្វើវិញ (Undo)',
          duration: 6000,
          onAction: () => {
            setHistoryList((cur) => {
              const restored = [...cur.slice(0, idx), deletedItem, ...cur.slice(idx)]
              saveHistory(restored)
              return restored
            })
            triggerHaptic('light')
            speakAccessibility(`បានស្តារឡើងវិញនូវឯកសារ ${deletedItem.name}`)
            addToast(`បានស្តារ "${deletedItem.name}" ឡើងវិញ`, 'success')
          },
        })
        return next
      })
    },
    [saveHistory, addToast, triggerHaptic, speakAccessibility]
  )

  const clearHistory = useCallback(() => {
    setHistoryList((prev) => {
      const previousHistory = prev
      saveHistory([])
      addToast('បានសម្អាតប្រវត្តិអានទាំងអស់', 'warning', {
        actionLabel: 'មិនធ្វើវិញ (Undo)',
        duration: 6000,
        onAction: () => {
          setHistoryList(previousHistory)
          saveHistory(previousHistory)
          addToast('បានស្តារប្រវត្តិឡើងវិញ', 'success')
        },
      })
      return []
    })
  }, [saveHistory, addToast])

  const handleScanAgain = useCallback(() => {
    triggerHaptic('light')
    setSelectedFile(null)
    setSelectedFileName('')
    setExtractedText('')
    setPreviewUri(null)
    setOcrError(null)
    speakAccessibility('ត្រឡប់ទៅការស្កេនឯកសារ')
  }, [triggerHaptic, speakAccessibility])

  const value = useMemo(
    () => ({
      selectedFile,
      previewUri,
      selectedFileName,
      extractedText,
      isProcessing,
      isLongProcessing,
      isCached,
      historyList,
      ocrError,
      ocrProgress,
      sampleLibrary,
      setFile,
      clearFile,
      captureAndScan,
      loadSample,
      openSampleQuietly,
      discardTourSample,
      triggerOcr,
      loadHistoryItem,
      quickPlayHistoryItem,
      renameHistoryItem,
      deleteHistoryItem,
      clearHistory,
      handleScanAgain,
      setAutoReadHandler,
      setExtractedText,
    }),
    [
      selectedFile,
      previewUri,
      selectedFileName,
      extractedText,
      isProcessing,
      isLongProcessing,
      isCached,
      historyList,
      ocrError,
      ocrProgress,
      setFile,
      clearFile,
      captureAndScan,
      loadSample,
      openSampleQuietly,
      discardTourSample,
      triggerOcr,
      loadHistoryItem,
      quickPlayHistoryItem,
      renameHistoryItem,
      deleteHistoryItem,
      clearHistory,
      handleScanAgain,
      setAutoReadHandler,
    ]
  )

  return <OcrContext.Provider value={value}>{children}</OcrContext.Provider>
}

export function useOcr() {
  const ctx = useContext(OcrContext)
  if (!ctx) throw new Error('useOcr must be used within an OcrProvider')
  return ctx
}
