import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Speech from 'expo-speech'
import { createAudioPlayer } from 'expo-audio'
import { useApp } from './AppContext'
import { useOcr } from './OcrContext'
import { synthesizeTextAzureTTS, synthesizeTextCloudTTS } from '../services/tts'
import { CLOUD_API_AVAILABLE } from '../services/cloudApi'
import { getTtsCache, setTtsCache } from '../services/cache'

export const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 2.0]

const TtsContext = createContext(null)

export function TtsProvider({ children }) {
  const { triggerHaptic, speakAccessibility, ocrConfig } = useApp()
  const { extractedText, setAutoReadHandler } = useOcr()

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activeWordIndex, setActiveWordIndex] = useState(-1)
  const [rate, setRate] = useState(1.0)
  const [voices, setVoices] = useState([])
  const [selectedVoiceName, setSelectedVoiceName] = useState('')

  const tokensRef = useRef([])
  const highlightIntervalRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const audioSubRef = useRef(null)
  const rateRef = useRef(1.0)
  const voicesRef = useRef([])
  const selectedVoiceNameRef = useRef('')

  useEffect(() => { rateRef.current = rate }, [rate])
  useEffect(() => { voicesRef.current = voices }, [voices])
  useEffect(() => { selectedVoiceNameRef.current = selectedVoiceName }, [selectedVoiceName])

  // --- Load voices: Azure's two fixed neural voices if a key is configured,
  // otherwise the device's installed TTS voices (expo-speech's async
  // equivalent of the web's synchronous speechSynthesis.getVoices()). ---
  useEffect(() => {
    ;(async () => {
      if (ocrConfig.azureTtsKey || CLOUD_API_AVAILABLE) {
        const azureVoices = [
          { name: 'km-KH-PisethNeural', lang: 'km-KH', label: 'Piseth (សំឡេងប្រុស)', gender: 'Male' },
          { name: 'km-KH-SreymomNeural', lang: 'km-KH', label: 'Sreymom (សំឡេងស្រី)', gender: 'Female' },
        ]
        setVoices(azureVoices)
        setSelectedVoiceName(azureVoices[0].name)
        return
      }

      try {
        const available = await Speech.getAvailableVoicesAsync()
        const khmerVoices = (available || []).filter((v) => {
          const l = (v.language || '').toLowerCase().replace(/_/g, '-')
          const n = (v.name || '').toLowerCase()
          return l.startsWith('km') || l.includes('khm') || n.includes('khmer')
        })

        if (khmerVoices.length > 0) {
          const mapped = khmerVoices.map((v, i) => ({
            name: v.identifier,
            lang: v.language,
            label: i === 0 ? 'Piseth (សំឡេងប្រុស - Khmer)' : 'Sreymom (សំឡេងស្រី - Khmer)',
            gender: i === 0 ? 'Male' : 'Female',
          }))
          setVoices(mapped)
          setSelectedVoiceName(mapped[0].name)
        } else {
          const defaultKhmer = [
            { name: 'km-KH-Piseth', lang: 'km-KH', label: 'Piseth (សំឡេងប្រុស)', gender: 'Male' },
            { name: 'km-KH-Sreymom', lang: 'km-KH', label: 'Sreymom (សំឡេងស្រី)', gender: 'Female' },
          ]
          setVoices(defaultKhmer)
          setSelectedVoiceName(defaultKhmer[0].name)
        }
      } catch (e) {
        console.warn('getAvailableVoicesAsync error:', e)
      }
    })()
    // Re-runs once AppContext finishes loading a persisted Azure TTS key from
    // AsyncStorage (starts empty on mount, same as ocrConfig itself).
  }, [ocrConfig.azureTtsKey])

  const clearHighlightInterval = useCallback(() => {
    if (highlightIntervalRef.current) {
      clearInterval(highlightIntervalRef.current)
      highlightIntervalRef.current = null
    }
  }, [])

  // Word-by-word timing sync — expo-speech (like the web's SpeechSynthesis)
  // gives no per-word boundary callback, so this is the same estimated-timer
  // approach the original app used, not derived from real audio timestamps.
  const startHighlighting = useCallback(
    (startIndex = 0) => {
      setActiveWordIndex(startIndex)
      const durationPerWord = Math.max(280, Math.round(700 / rateRef.current))
      clearHighlightInterval()
      highlightIntervalRef.current = setInterval(() => {
        setActiveWordIndex((prev) => {
          if (prev < tokensRef.current.length - 1) return prev + 1
          clearHighlightInterval()
          return prev
        })
      }, durationPerWord)
    },
    [clearHighlightInterval]
  )

  const releaseAudioPlayer = useCallback(() => {
    if (audioSubRef.current) {
      audioSubRef.current.remove()
      audioSubRef.current = null
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.remove()
      } catch (e) {}
      audioPlayerRef.current = null
    }
  }, [])

  const stopSpeech = useCallback(() => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause()
      } catch (e) {}
      releaseAudioPlayer()
    }
    Speech.stop()
    setIsSpeaking(false)
    setIsPaused(false)
    setActiveWordIndex(-1)
    clearHighlightInterval()
  }, [releaseAudioPlayer, clearHighlightInterval])

  const fallbackWebSpeech = useCallback(
    (text) => {
      setIsSpeaking(true)
      setIsPaused(false)
      const voice = voicesRef.current.find((v) => v.name === selectedVoiceNameRef.current)
      const isSreymom = voice?.gender === 'Female' || (voice?.label || '').includes('ស្រី')
      Speech.speak(text, {
        voice: voice?.name,
        rate: rateRef.current,
        pitch: isSreymom ? 1.15 : 0.95,
        language: 'km-KH',
        onDone: () => stopSpeech(),
        onStopped: () => {},
        onError: () => stopSpeech(),
      })
      startHighlighting(0)
    },
    [stopSpeech, startHighlighting]
  )

  const startSpeech = useCallback(async () => {
    if (!extractedText) {
      speakAccessibility('មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ')
      return
    }

    // Resume if paused
    if (isPaused) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.play()
      } else {
        Speech.resume()
      }
      setIsPaused(false)
      setIsSpeaking(true)
      startHighlighting(activeWordIndex === -1 ? 0 : activeWordIndex)
      triggerHaptic('light')
      speakAccessibility('បន្តការអាន')
      return
    }

    stopSpeech()
    setIsSpeaking(true)
    setIsPaused(false)
    triggerHaptic('medium')
    speakAccessibility('ចាប់ផ្តើមអាន...')

    // The user's own Azure key if they entered one, else the api/tts proxy.
    const azureKey = ocrConfig.azureTtsKey
    const azureEndpoint = ocrConfig.azureTtsEndpoint || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'

    if (azureKey || CLOUD_API_AVAILABLE) {
      try {
        const selectedVoice = voicesRef.current.find((v) => v.name === selectedVoiceNameRef.current)
        const voiceName = selectedVoice ? selectedVoice.name : 'km-KH-PisethNeural'
        const gender = selectedVoice?.gender || 'Male'

        let audioUri = getTtsCache(extractedText, voiceName, 1.0)
        if (!audioUri) {
          audioUri = azureKey
            ? await synthesizeTextAzureTTS(extractedText, azureKey, azureEndpoint, 1.0, 1.0, voiceName, gender)
            : await synthesizeTextCloudTTS(extractedText, voiceName)
          setTtsCache(extractedText, voiceName, 1.0, audioUri)
        }

        const player = createAudioPlayer({ uri: audioUri })
        audioPlayerRef.current = player
        player.volume = 1.0
        player.playbackRate = rateRef.current
        audioSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            stopSpeech()
            speakAccessibility('ការអានអត្ថបទបានបញ្ចប់')
          }
        })
        player.play()
        startHighlighting(0)
        return
      } catch (error) {
        console.error(error)
        setIsSpeaking(false)
        fallbackWebSpeech(extractedText)
        return
      }
    }

    fallbackWebSpeech(extractedText)
  }, [extractedText, isPaused, activeWordIndex, stopSpeech, startHighlighting, triggerHaptic, speakAccessibility, fallbackWebSpeech, ocrConfig])

  const pauseSpeech = useCallback(() => {
    if (!isSpeaking) return
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    } else {
      try {
        Speech.pause()
      } catch (e) {}
    }
    setIsPaused(true)
    setIsSpeaking(false)
    clearHighlightInterval()
    triggerHaptic('light')
    speakAccessibility('បានផ្អាកការអាន')
  }, [isSpeaking, clearHighlightInterval, triggerHaptic, speakAccessibility])

  const togglePlayback = useCallback(() => {
    if (isSpeaking) pauseSpeech()
    else startSpeech()
  }, [isSpeaking, pauseSpeech, startSpeech])

  const restartSpeech = useCallback(() => {
    stopSpeech()
    startSpeech()
    triggerHaptic('medium')
    speakAccessibility('អានឡើងវិញតាំងពីដើម')
  }, [stopSpeech, startSpeech, triggerHaptic, speakAccessibility])

  const seekToWord = useCallback(
    (wordIndex) => {
      if (wordIndex < 0 || wordIndex >= tokensRef.current.length) return
      setActiveWordIndex(wordIndex)
      if (isSpeaking) startHighlighting(wordIndex)
    },
    [isSpeaking, startHighlighting]
  )

  const jumpWords = useCallback(
    (delta) => {
      const next = Math.max(0, Math.min(tokensRef.current.length - 1, activeWordIndex + delta))
      seekToWord(next)
      triggerHaptic('light')
      speakAccessibility(delta > 0 ? 'រំលងទៅមុខ' : 'ថយក្រោយ')
    },
    [activeWordIndex, seekToWord, triggerHaptic, speakAccessibility]
  )

  const setSpeedPreset = useCallback(
    (val) => {
      setRate(val)
      if (audioPlayerRef.current) audioPlayerRef.current.playbackRate = val
      triggerHaptic('light')
      speakAccessibility(`ប្តូរល្បឿនអានទៅ ${val} ដង`)
    },
    [triggerHaptic, speakAccessibility]
  )

  const selectVoice = useCallback((name) => setSelectedVoiceName(name), [])

  // Re-tokenize and stop any playback whenever the underlying text changes —
  // mirrors the web app's `watch(() => props.text, ..., { immediate: true })`.
  useEffect(() => {
    tokensRef.current = extractedText ? extractedText.trim().split(/\s+/).filter((w) => w.length > 0) : []
    stopSpeech()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedText])

  useEffect(() => {
    setAutoReadHandler(() => startSpeech())
    return () => setAutoReadHandler(null)
  }, [setAutoReadHandler, startSpeech])

  useEffect(() => () => stopSpeech(), [stopSpeech])

  const value = useMemo(
    () => ({
      isSpeaking,
      isPaused,
      activeWordIndex,
      rate,
      voices,
      selectedVoiceName,
      speedPresets: SPEED_PRESETS,
      togglePlayback,
      startSpeech,
      pauseSpeech,
      stopSpeech,
      restartSpeech,
      seekToWord,
      jumpWords,
      setSpeedPreset,
      selectVoice,
    }),
    [
      isSpeaking,
      isPaused,
      activeWordIndex,
      rate,
      voices,
      selectedVoiceName,
      togglePlayback,
      startSpeech,
      pauseSpeech,
      stopSpeech,
      restartSpeech,
      seekToWord,
      jumpWords,
      setSpeedPreset,
      selectVoice,
    ]
  )

  return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>
}

export function useTts() {
  const ctx = useContext(TtsContext)
  if (!ctx) throw new Error('useTts must be used within a TtsProvider')
  return ctx
}
