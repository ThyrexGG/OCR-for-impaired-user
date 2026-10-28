import { Platform } from 'react-native'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Speech from 'expo-speech'
import { createAudioPlayer } from 'expo-audio'
import { useApp } from './AppContext'
import { useOcr } from './OcrContext'
import { synthesizeTextAzureTTS, synthesizeTextCloudTTS } from '../services/tts'
import { CLOUD_API_AVAILABLE } from '../services/cloudApi'
import { getTtsCache, setTtsCache } from '../services/cache'
import { subscribeSpeaking, whenSilent } from '../services/talkback'
import { TP } from '../services/talkPhrases'

// While talk-back speaks, the document audio dips so the guidance is clearly heard.
const DUCKED_VOLUME = 0.2
const APP_VOICE_FAILED = 'មិនអាចភ្ជាប់សំឡេង songKHEM បានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។'

export const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 2.0]

const TtsContext = createContext(null)

export function TtsProvider({ children }) {
  const { triggerHaptic, speakAccessibility, announce, ocrConfig, isAppVoiceOnly, addToast } = useApp()
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
  const tokenFracsRef = useRef([])
  const activeWordRef = useRef(-1)
  const isPausedRef = useRef(false)
  const speechModeRef = useRef(false)
  const speechSessionRef = useRef(0)
  const pendingSeekRef = useRef(null)
  const pendingSpeechStartRef = useRef(null)
  const duckedRef = useRef(false)
  const appVoiceOnlyRef = useRef(false)
  useEffect(() => { appVoiceOnlyRef.current = isAppVoiceOnly }, [isAppVoiceOnly])

  useEffect(() => { rateRef.current = rate }, [rate])
  useEffect(() => { voicesRef.current = voices }, [voices])
  useEffect(() => { selectedVoiceNameRef.current = selectedVoiceName }, [selectedVoiceName])
  useEffect(() => { activeWordRef.current = activeWordIndex }, [activeWordIndex])
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])

  useEffect(
    () =>
      subscribeSpeaking((speaking) => {
        duckedRef.current = speaking
        if (audioPlayerRef.current) audioPlayerRef.current.volume = speaking ? DUCKED_VOLUME : 1
      }),
    []
  )

  // --- Load voices: Azure's two fixed neural voices if a key is configured,
  // otherwise the device's installed TTS voices (expo-speech's async
  // equivalent of the web's synchronous speechSynthesis.getVoices()). ---
  useEffect(() => {
    ;(async () => {
      if (ocrConfig.azureTtsKey || CLOUD_API_AVAILABLE) {
        const azureVoices = [
          { name: 'km-KH-PisethNeural', lang: 'km-KH', label: 'Piseth (សំឡេងប្រុស)', gender: 'Male' },
          { name: 'km-KH-SreymomNeural', lang: 'km-KH', label: 'Sreymom (សំឡេងស្រី)', gender: 'Female' },
          { name: 'km-KH-SokhaMedical', lang: 'km-KH', label: 'Dr. Sokha (គ្រូពេទ្យ សុខា - វេជ្ជបញ្ជា)', gender: 'Male' },
          { name: 'km-KH-VitsOffline', lang: 'km-KH', label: 'songKHEM-VITS (ម៉ូដែលរបស់យើង)', gender: 'Male' },
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

  const setPaused = useCallback((value) => {
    isPausedRef.current = value
    setIsPaused(value)
  }, [])

  // Word index for a playback fraction (0..1), weighted by word length so the
  // highlight follows the audio clock instead of a fixed per-word timer.
  const indexForFraction = useCallback((fraction) => {
    const fracs = tokenFracsRef.current
    if (!fracs.length) return -1
    let idx = 0
    for (let i = 0; i < fracs.length; i++) {
      if (fracs[i] <= fraction) idx = i
      else break
    }
    return idx
  }, [])

  const stopSpeech = useCallback(() => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause()
      } catch (e) {}
      releaseAudioPlayer()
    }
    speechSessionRef.current += 1
    speechModeRef.current = false
    pendingSeekRef.current = null
    pendingSpeechStartRef.current = null
    Speech.stop()
    setIsSpeaking(false)
    setPaused(false)
    setActiveWordIndex(-1)
    clearHighlightInterval()
  }, [releaseAudioPlayer, clearHighlightInterval, setPaused])

  // Device voice (expo-speech). It cannot seek, so a skip restarts the utterance
  // from the chosen word: only the remaining words are spoken.
  const fallbackWebSpeech = useCallback(
    (text, startIndex = 0) => {
      stopSpeech()
      // Testing switch "songKHEM voice only": never hand the document to the phone's voice
      if (appVoiceOnlyRef.current) {
        addToast(APP_VOICE_FAILED, 'warning')
        speakAccessibility(APP_VOICE_FAILED)
        return
      }
      setIsSpeaking(true)
      setPaused(false)
      speechModeRef.current = true
      const session = speechSessionRef.current
      const spokenText = startIndex > 0 && tokensRef.current.length ? tokensRef.current.slice(startIndex).join(' ') : text
      const voice = voicesRef.current.find((v) => v.name === selectedVoiceNameRef.current)
      const isSreymom = voice?.gender === 'Female' || (voice?.label || '').includes('ស្រី')
      Speech.speak(spokenText, {
        voice: voice?.name,
        rate: rateRef.current,
        pitch: isSreymom ? 1.15 : 0.95,
        language: 'km-KH',
        // Ignore events from an utterance a skip has already replaced
        onDone: () => { if (speechSessionRef.current === session) stopSpeech() },
        onStopped: () => {},
        onError: () => { if (speechSessionRef.current === session) stopSpeech() },
      })
      startHighlighting(startIndex)
    },
    [stopSpeech, startHighlighting, setPaused, addToast, speakAccessibility]
  )

  const startSpeech = useCallback(async () => {
    if (!extractedText) {
      speakAccessibility('មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ')
      return
    }

    // Resume if paused (ref, not state: restartSpeech calls stop + start in the same tick)
    if (isPausedRef.current) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.play()
        // The audio clock drives the highlight again via playbackStatusUpdate
      } else if (speechModeRef.current && (Platform.OS === 'android' || pendingSpeechStartRef.current !== null)) {
        // expo-speech can't resume on Android and can't seek: restart from the paused/skipped word
        const from = pendingSpeechStartRef.current ?? Math.max(0, activeWordRef.current)
        fallbackWebSpeech(extractedText, from)
        triggerHaptic('light')
        return
      } else {
        Speech.resume()
        startHighlighting(Math.max(0, activeWordRef.current))
      }
      setPaused(false)
      setIsSpeaking(true)
      triggerHaptic('light')
      return
    }

    stopSpeech()
    const session = speechSessionRef.current
    setIsSpeaking(true)
    setPaused(false)
    triggerHaptic('medium')
    speakAccessibility(TP.readingStarted.km, false)

    // The user's own Azure key if they entered one, else the api/tts proxy.
    const azureKey = ocrConfig.azureTtsKey
    const azureEndpoint = ocrConfig.azureTtsEndpoint || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'

    if (azureKey || CLOUD_API_AVAILABLE) {
      try {
        const selectedVoice = voicesRef.current.find((v) => v.name === selectedVoiceNameRef.current)
        const voiceName = selectedVoice ? selectedVoice.name : 'km-KH-PisethNeural'
        const gender = selectedVoice?.gender || 'Male'
        // Sokha / songKHEM-VITS are songKHEM personas served by api/tts, not real Azure voice names
        const isPersona = voiceName === 'km-KH-VitsOffline' || voiceName === 'km-KH-SokhaMedical'
        const useAzureDirect = Boolean(azureKey) && !isPersona

        let audioUri = getTtsCache(extractedText, voiceName, 1.0)
        if (!audioUri) {
          audioUri = useAzureDirect
            ? await synthesizeTextAzureTTS(extractedText, azureKey, azureEndpoint, 1.0, 1.0, voiceName, gender)
            : await synthesizeTextCloudTTS(extractedText, voiceName)
          setTtsCache(extractedText, voiceName, 1.0, audioUri)
        }

        // Stopped (or restarted) while the audio was being synthesized
        if (speechSessionRef.current !== session) return

        // Let the control label / announcement that led here finish before the document voice begins
        await whenSilent()
        if (speechSessionRef.current !== session) return

        const player = createAudioPlayer({ uri: audioUri }, { updateInterval: 100 })
        audioPlayerRef.current = player
        player.volume = duckedRef.current ? DUCKED_VOLUME : 1.0
        player.setPlaybackRate(rateRef.current)
        audioSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            stopSpeech()
            speakAccessibility('ការអានអត្ថបទបានបញ្ចប់')
            return
          }
          const duration = status.duration
          if (!(duration > 0)) return
          // A skip tapped before the duration was known is applied as soon as it is
          if (pendingSeekRef.current !== null) {
            const pending = pendingSeekRef.current
            pendingSeekRef.current = null
            player.seekTo(duration * (tokenFracsRef.current[pending] ?? 0) + 0.02).catch(() => {})
            return
          }
          // Highlight locked to the real audio playhead
          if (status.playing) {
            const idx = indexForFraction(status.currentTime / duration)
            if (idx >= 0) setActiveWordIndex((prev) => (prev === idx ? prev : idx))
          }
        })
        player.play()
        // A skip tapped while the voice was still being synthesized wins over word 0
        setActiveWordIndex(pendingSeekRef.current !== null ? pendingSeekRef.current : 0)
        return
      } catch (error) {
        console.error(error)
        if (speechSessionRef.current !== session) return
        await whenSilent()
        if (speechSessionRef.current !== session) return
        fallbackWebSpeech(extractedText, Math.max(0, activeWordRef.current))
        return
      }
    }

    await whenSilent()
    if (speechSessionRef.current !== session) return
    fallbackWebSpeech(extractedText)
  }, [extractedText, stopSpeech, startHighlighting, triggerHaptic, speakAccessibility, fallbackWebSpeech, indexForFraction, setPaused, ocrConfig])

  const pauseSpeech = useCallback(() => {
    if (!isSpeaking) return
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    } else if (Platform.OS === 'android') {
      // expo-speech has no pause on Android: stop and resume from the current word instead
      Speech.stop()
      pendingSpeechStartRef.current = Math.max(0, activeWordRef.current)
    } else {
      try {
        Speech.pause()
      } catch (e) {}
    }
    setPaused(true)
    setIsSpeaking(false)
    clearHighlightInterval()
    triggerHaptic('light')
    speakAccessibility('បានផ្អាកការអាន')
  }, [isSpeaking, clearHighlightInterval, triggerHaptic, speakAccessibility, setPaused])

  const togglePlayback = useCallback(() => {
    if (isSpeaking) pauseSpeech()
    else startSpeech()
  }, [isSpeaking, pauseSpeech, startSpeech])

  const restartSpeech = useCallback(() => {
    stopSpeech()
    startSpeech()
    triggerHaptic('medium')
  }, [stopSpeech, startSpeech, triggerHaptic, speakAccessibility])

  const seekToWord = useCallback(
    (wordIndex) => {
      if (wordIndex < 0 || wordIndex >= tokensRef.current.length) return
      setActiveWordIndex(wordIndex)
      activeWordRef.current = wordIndex

      // Neural voice: seek the real audio playhead (or queue it until the duration is known)
      const player = audioPlayerRef.current
      if (player) {
        const duration = player.duration
        if (duration > 0) {
          pendingSeekRef.current = null
          player.seekTo(duration * (tokenFracsRef.current[wordIndex] ?? 0) + 0.02).catch(() => {})
        } else {
          pendingSeekRef.current = wordIndex
        }
        return
      }

      // Device voice: restart the utterance from this word (or remember it while paused)
      if (speechModeRef.current) {
        if (isPausedRef.current) pendingSpeechStartRef.current = wordIndex
        else fallbackWebSpeech(extractedText, wordIndex)
        return
      }

      // Neural audio still being fetched: honour the skip once playback starts
      if (isSpeaking) {
        pendingSeekRef.current = wordIndex
        return
      }
    },
    [isSpeaking, fallbackWebSpeech, extractedText]
  )

  const jumpWords = useCallback(
    (delta) => {
      if (!tokensRef.current.length) return
      const current = activeWordRef.current >= 0 ? activeWordRef.current : 0
      const next = Math.max(0, Math.min(tokensRef.current.length - 1, current + delta))
      seekToWord(next)
      triggerHaptic('light')
      // Screen-reader announcement only: speaking over (or Speech.stop()-ing) the reading made skip unusable
      announce(delta > 0 ? 'រំលងទៅមុខ' : 'ថយក្រោយ')
    },
    [seekToWord, triggerHaptic, announce]
  )

  const setSpeedPreset = useCallback(
    (val) => {
      setRate(val)
      if (audioPlayerRef.current) audioPlayerRef.current.setPlaybackRate(val)
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
    // Start-of-word fractions weighted by length, to map the audio playhead <-> word index
    const totalChars = tokensRef.current.reduce((sum, w) => sum + w.length, 0) || 1
    let consumed = 0
    tokenFracsRef.current = tokensRef.current.map((w) => {
      const start = consumed / totalChars
      consumed += w.length
      return start
    })
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
