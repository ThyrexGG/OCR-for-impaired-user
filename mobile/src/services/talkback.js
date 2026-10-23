/**
 * Talk-back speech engine (native).
 *
 * Spoken UI feedback has to start the instant a finger lands, so nothing here
 * waits on the network for anything that can be known ahead of time:
 *   1. phrases in the bundled voice pack (services/voicePack.js) play straight
 *      from the APK;
 *   2. other text is synthesized through api/tts the first time and then kept
 *      in memory, with every segment of a message requested in parallel so the
 *      later parts are ready by the time the first one finishes;
 *   3. if synthesis is unavailable, the device's own Khmer voice is used.
 * A new message cuts the previous one off immediately (generation counter), and
 * a stale message that was still being fetched can never start playing late.
 */
import * as Speech from 'expo-speech'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { VOICE_PACK } from './voicePack'
import { spokenForm, voiceKey } from './talkPhrases'
import { CLOUD_API_AVAILABLE } from './cloudApi'
import { synthesizeTextCloudTTS } from './tts'

const UI_VOICE = 'km-KH-SreymomNeural'
const MAX_LIVE_CACHE = 80
const SEGMENT_TIMEOUT_MS = 15000

let rate = 1.25
let generation = 0
let tail = Promise.resolve()
let currentPlayer = null
let cancelCurrent = null
let audioModeReady = false
let deviceActive = false // true only while this engine itself is using expo-speech

const liveCache = new Map() // key -> Promise<{ uri }>

const speakingListeners = new Set()
let speakingCount = 0
let idleTimer = null
const emitSpeaking = (value) => speakingListeners.forEach((fn) => fn(value))

const markStart = () => {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (speakingCount++ === 0) emitSpeaking(true)
}

const markEnd = () => {
  speakingCount = Math.max(0, speakingCount - 1)
  if (speakingCount === 0 && !idleTimer) {
    // A short grace period so the gap between two segments of one message is not "silence"
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (speakingCount === 0) emitSpeaking(false)
    }, 180)
  }
}

/** Notifies true when talk-back starts speaking and false once it falls quiet (for ducking the reader). */
export const subscribeSpeaking = (fn) => {
  speakingListeners.add(fn)
  return () => speakingListeners.delete(fn)
}

export const setSpeechRate = (value) => {
  rate = Math.min(2.5, Math.max(0.75, Number(value) || 1))
}

const ensureAudioMode = () => {
  if (audioModeReady) return
  audioModeReady = true
  try {
    Promise.resolve(setAudioModeAsync({ playsInSilentMode: true })).catch(() => {})
  } catch (e) {}
}

const resolveSegment = (text) => {
  const key = voiceKey(text)
  if (VOICE_PACK[key] !== undefined) return Promise.resolve({ source: VOICE_PACK[key] })
  if (liveCache.has(key)) return liveCache.get(key)
  if (!CLOUD_API_AVAILABLE) return Promise.resolve(null)

  const pending = synthesizeTextCloudTTS(text, UI_VOICE).then((uri) => ({ source: { uri } }))
  liveCache.set(key, pending)
  pending.catch(() => liveCache.delete(key))
  if (liveCache.size > MAX_LIVE_CACHE) liveCache.delete(liveCache.keys().next().value)
  return pending
}

const playSource = (source, gen) =>
  new Promise((resolve) => {
    if (gen !== generation) return resolve()
    let finished = false
    let player
    let sub
    let timer

    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      try { sub && sub.remove() } catch (e) {}
      try { player && player.remove() } catch (e) {}
      if (currentPlayer === player) currentPlayer = null
      if (cancelCurrent === finish) cancelCurrent = null
      markEnd()
      resolve()
    }

    try {
      ensureAudioMode()
      markStart()
      player = createAudioPlayer(source)
      currentPlayer = player
      cancelCurrent = finish
      player.volume = 1
      player.playbackRate = rate
      sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) finish()
      })
      timer = setTimeout(finish, SEGMENT_TIMEOUT_MS)
      player.play()
    } catch (e) {
      finish()
    }
  })

const deviceSpeak = (text, gen) =>
  new Promise((resolve) => {
    if (gen !== generation) return resolve()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      deviceActive = false
      if (cancelCurrent === finish) cancelCurrent = null
      markEnd()
      resolve()
    }
    try {
      markStart()
      deviceActive = true
      cancelCurrent = finish
      Speech.speak(text, { language: 'km-KH', rate: Math.min(2, rate), onDone: finish, onStopped: finish, onError: finish })
    } catch (e) {
      finish()
    }
  })

const runMessage = async (segments, fetched, gen) => {
  for (let i = 0; i < segments.length; i++) {
    if (gen !== generation) return
    let resolved = null
    try {
      resolved = await fetched[i]
    } catch (e) {
      resolved = null
    }
    if (gen !== generation) return
    if (resolved) await playSource(resolved.source, gen)
    else await deviceSpeak(segments[i], gen)
  }
}

/** Stops whatever is being spoken and drops anything still queued or in flight. */
export const stopSpeaking = () => {
  generation += 1
  tail = Promise.resolve()
  const wasDevice = deviceActive
  if (cancelCurrent) {
    const cancel = cancelCurrent
    cancelCurrent = null
    if (currentPlayer) {
      try { currentPlayer.pause() } catch (e) {}
    }
    cancel()
  }
  // Never touch expo-speech unless this engine started the utterance: the reader may be using it
  if (wasDevice) {
    try { Speech.stop() } catch (e) {}
  }
}

/**
 * @param {string|string[]} input  a message, or several segments spoken back to back
 * @param {{ interrupt?: boolean }} options  interrupt (default) cuts the current message off first
 */
export const speakNow = (input, { interrupt = true } = {}) => {
  const segments = (Array.isArray(input) ? input : [input]).map(spokenForm).filter(Boolean)
  if (!segments.length) return
  if (interrupt) stopSpeaking()
  const gen = generation
  // Start every fetch now; playback then walks them in order.
  const fetched = segments.map((s) => resolveSegment(s).catch(() => null))
  tail = tail.then(() => runMessage(segments, fetched, gen))
}

/** Fetches phrases into the live cache ahead of time (e.g. a document title about to be announced). */
export const warmUp = (texts) => {
  ;(Array.isArray(texts) ? texts : [texts]).map(spokenForm).filter(Boolean).forEach((t) => resolveSegment(t).catch(() => {}))
}

// --- Explore-by-touch focus: the control that was just announced and is waiting for its second tap ---
const ARM_WINDOW_MS = 6000
let armedKey = null
let armedTimer = null
const armedListeners = new Set()

export const subscribeArmed = (fn) => {
  armedListeners.add(fn)
  return () => armedListeners.delete(fn)
}

export const getArmedKey = () => armedKey

export const setArmedKey = (key) => {
  if (armedTimer) {
    clearTimeout(armedTimer)
    armedTimer = null
  }
  armedKey = key
  armedListeners.forEach((fn) => fn())
  if (key) {
    armedTimer = setTimeout(() => {
      armedTimer = null
      armedKey = null
      armedListeners.forEach((fn) => fn())
    }, ARM_WINDOW_MS)
  }
}
