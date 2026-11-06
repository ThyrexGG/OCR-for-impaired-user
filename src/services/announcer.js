/**
 * Announcer Service (Port & Adapter)
 * Conforms to .agents/ProjectInstruction.md §5.2 & §6.2
 * Single Responsibility: Delivers screen-reader announcements and audible UI guidance (talk-back).
 *
 * Spoken feedback has to start the moment a finger lands, so nothing waits on the network for
 * anything that can be known ahead of time:
 *   1. Khmer phrases in the pre-recorded voice pack (public/voice, built by
 *      scripts/build-voice-pack.mjs) play straight from the browser cache;
 *   2. other Khmer text is synthesized through /api/tts once and then kept in memory, with every
 *      segment of a message requested in parallel so later parts are ready when the first ends;
 *   3. English, or Khmer when synthesis is unreachable, goes to the browser's own speechSynthesis.
 * A new message cuts the previous one off synchronously (generation counter), and a stale message
 * that was still being fetched can never start playing late.
 */

import { currentLang } from './i18n'
import { isAppVoiceOnly, synthesizeLocalKhmerTTS } from './tts'
import { spokenForm, voiceKey } from './talkPhrases'

const UI_VOICE = 'km-KH-SreymomNeural'
const KHMER = /[ក-៿]/
const MAX_LIVE_CACHE = 80

class AnnouncerService {
  constructor() {
    this._isVoiceEnabled = false
    this._rate = 1
    this._liveRegionPolite = null
    this._liveRegionAssertive = null
    this._lastMessage = ''
    this._lastSpokenTime = 0
    this._generation = 0
    this._tail = Promise.resolve()
    this._activeAudio = null
    this._cancelCurrent = null
    this._usedSynth = false
    this._packKeys = null
    this._packLoading = null
    this._live = new Map()
    this._speakingCount = 0
    this._pending = 0
    this._idleTimer = null
    this._speakingListeners = new Set()
    this._pendingUntilActive = null
  }

  setVoiceEnabled(enabled) {
    this._isVoiceEnabled = Boolean(enabled)
    if (this._isVoiceEnabled) this._loadPackIndex()
    else this.stop()
  }

  isVoiceEnabled() {
    return this._isVoiceEnabled
  }

  setRate(value) {
    this._rate = Math.min(2.5, Math.max(0.75, Number(value) || 1))
  }

  getRate() {
    return this._rate
  }

  /**
   * Resolves once talk-back has said everything it was asked to, plus a short breath, so the reader's
   * voice never starts on top of a control label or announcement. Gives up after maxWaitMs.
   */
  whenSilent({ gapMs = 350, maxWaitMs = 4000 } = {}) {
    return new Promise((resolve) => {
      const deadline = Date.now() + maxWaitMs
      let quietSince = 0
      const poll = () => {
        const busy = this._pending > 0 || this._speakingCount > 0
        if (busy) quietSince = 0
        else if (!quietSince) quietSince = Date.now()
        if ((!busy && Date.now() - quietSince >= gapMs) || Date.now() >= deadline) return resolve()
        setTimeout(poll, 40)
      }
      poll()
    })
  }

  /** Called with true when talk-back starts speaking and false once it falls quiet (to duck the reader). */
  onSpeakingChange(fn) {
    this._speakingListeners.add(fn)
    return () => this._speakingListeners.delete(fn)
  }

  _markStart() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer)
      this._idleTimer = null
    }
    if (this._speakingCount++ === 0) this._speakingListeners.forEach((fn) => fn(true))
  }

  _markEnd() {
    this._speakingCount = Math.max(0, this._speakingCount - 1)
    if (this._speakingCount === 0 && !this._idleTimer) {
      // A short grace period so the gap between two segments of one message is not silence
      this._idleTimer = setTimeout(() => {
        this._idleTimer = null
        if (this._speakingCount === 0) this._speakingListeners.forEach((fn) => fn(false))
      }, 180)
    }
  }

  /**
   * Initialize or retrieve ARIA live regions in DOM
   */
  _ensureLiveRegions() {
    if (typeof document === 'undefined') return
    if (!this._liveRegionPolite) {
      let polite = document.getElementById('a11y-live-polite')
      if (!polite) {
        polite = document.createElement('div')
        polite.id = 'a11y-live-polite'
        polite.setAttribute('aria-live', 'polite')
        polite.setAttribute('aria-atomic', 'true')
        polite.className = 'sr-only'
        document.body.appendChild(polite)
      }
      this._liveRegionPolite = polite
    }

    if (!this._liveRegionAssertive) {
      let assertive = document.getElementById('a11y-live-assertive')
      if (!assertive) {
        assertive = document.createElement('div')
        assertive.id = 'a11y-live-assertive'
        assertive.setAttribute('aria-live', 'assertive')
        assertive.setAttribute('aria-atomic', 'true')
        assertive.className = 'sr-only'
        document.body.appendChild(assertive)
      }
      this._liveRegionAssertive = assertive
    }
  }

  /**
   * Announce to screen reader live region (TalkBack / NVDA / VoiceOver)
   * @param {string} message
   * @param {'polite'|'assertive'} priority
   */
  announce(message, priority = 'polite') {
    if (!message || typeof document === 'undefined') return
    this._ensureLiveRegions()

    const region = priority === 'assertive' ? this._liveRegionAssertive : this._liveRegionPolite
    if (region) {
      // Clear and re-populate so repeated identical announcements are picked up
      region.textContent = ''
      requestAnimationFrame(() => {
        region.textContent = message
      })
    }
  }

  _loadPackIndex() {
    if (this._packKeys) return Promise.resolve(this._packKeys)
    if (!this._packLoading) {
      this._packLoading = fetch('/voice/index.json')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
        .then((keys) => (this._packKeys = new Set(keys)))
    }
    return this._packLoading
  }

  /** Warms the browser cache with the named phrases so their first playback is instant. */
  async prefetch(texts) {
    const keys = await this._loadPackIndex()
    for (const text of texts.map(spokenForm).filter(Boolean)) {
      const key = voiceKey(text)
      if (keys.has(key)) fetch(`/voice/${key}.mp3`).catch(() => {})
    }
  }

  // Resolves one segment to something playable: a pack file, a synthesized blob, or "use speechSynthesis".
  async _resolve(text) {
    // "songKHEM voice only": English goes through our voice too, and nothing falls back to the browser's
    const appVoiceOnly = isAppVoiceOnly()
    if (!KHMER.test(text) && !appVoiceOnly) return { kind: 'synth', lang: 'en-US' }
    const key = voiceKey(text)
    const keys = await this._loadPackIndex()
    if (keys.has(key)) return { kind: 'audio', url: `/voice/${key}.mp3` }

    let pending = this._live.get(key)
    if (!pending) {
      pending = synthesizeLocalKhmerTTS(text, UI_VOICE, 1.0)
      this._live.set(key, pending)
      pending.catch(() => this._live.delete(key))
      if (this._live.size > MAX_LIVE_CACHE) this._live.delete(this._live.keys().next().value)
    }
    try {
      return { kind: 'audio', url: await pending }
    } catch (_) {
      return appVoiceOnly ? { kind: 'skip' } : { kind: 'synth', lang: 'km-KH' }
    }
  }

  _playAudio(url, gen) {
    return new Promise((resolve) => {
      if (gen !== this._generation) return resolve()
      const audio = new Audio(url)
      audio.playbackRate = this._rate
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        audio.onended = audio.onerror = null
        if (this._activeAudio === audio) this._activeAudio = null
        if (this._cancelCurrent === finish) this._cancelCurrent = null
        this._markEnd()
        resolve()
      }
      this._activeAudio = audio
      this._cancelCurrent = finish
      this._markStart()
      audio.onended = audio.onerror = finish
      audio.play().catch(finish) // blocked before the first user gesture: drop it quietly
    })
  }

  _speakSynth(text, lang, gen) {
    return new Promise((resolve) => {
      if (gen !== this._generation || typeof window === 'undefined' || !window.speechSynthesis) return resolve()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = Math.min(2, this._rate)
      utterance.lang = lang
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        this._usedSynth = false
        if (this._cancelCurrent === finish) this._cancelCurrent = null
        this._markEnd()
        resolve()
      }
      this._usedSynth = true
      this._cancelCurrent = finish
      this._markStart()
      utterance.onend = utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    })
  }

  async _run(segments, fetched, gen) {
    for (let i = 0; i < segments.length; i++) {
      if (gen !== this._generation) return
      const resolved = await fetched[i]
      if (gen !== this._generation) return
      if (resolved.kind === 'audio') await this._playAudio(resolved.url, gen)
      else if (resolved.kind === 'synth') await this._speakSynth(segments[i], resolved.lang, gen)
    }
  }

  /**
   * Speak audible UI guidance (for users without an OS screen reader).
   * @param {string|string[]} input a message, or several segments spoken back to back
   * @param {boolean} interrupt cut the current message off first (default)
   */
  speak(input, interrupt = true) {
    if (typeof window === 'undefined') return
    const segments = (Array.isArray(input) ? input : [input]).map(spokenForm).filter(Boolean)
    if (!segments.length) return

    // Guard against one gesture firing the same prompt twice (pointerdown + click, focus + click)
    const joined = segments.join(' ')
    const now = Date.now()
    if (joined === this._lastMessage && now - this._lastSpokenTime < 350) return
    this._lastMessage = joined
    this._lastSpokenTime = now

    // Always update screen reader live region first
    this.announce(joined, interrupt ? 'assertive' : 'polite')

    // Only speak aloud if self-contained voice guidance is turned ON
    if (!this._isVoiceEnabled) return

    if (interrupt) this.stop()
    const gen = this._generation
    // Start every fetch now; playback then walks them in order.
    const fetched = segments.map((s) => this._resolve(s))
    this._pending++
    this._tail = this._tail
      .then(() => this._run(segments, fetched, gen))
      .catch(() => {})
      .then(() => {
        this._pending = Math.max(0, this._pending - 1)
      })
  }

  /**
   * Speaks once the browser allows audio (needs a user gesture first). Used for the welcome message,
   * which is ready to play on the very first tap or key press.
   */
  speakWhenActive(input) {
    if (typeof window === 'undefined') return
    if (navigator.userActivation?.hasBeenActive) {
      this.speak(input)
      return
    }
    this._pendingUntilActive = input
    if (this._activationHooked) return
    this._activationHooked = true
    const release = () => {
      window.removeEventListener('pointerdown', release, true)
      window.removeEventListener('keydown', release, true)
      this._activationHooked = false
      const pending = this._pendingUntilActive
      this._pendingUntilActive = null
      // Let the gesture's own label go first; the welcome only fills a silent start
      if (pending) setTimeout(() => this._speakingCount === 0 && this.speak(pending), 120)
    }
    window.addEventListener('pointerdown', release, true)
    window.addEventListener('keydown', release, true)
  }

  stop() {
    this._generation += 1
    this._tail = Promise.resolve()
    const cancel = this._cancelCurrent
    this._cancelCurrent = null
    if (this._activeAudio) {
      this._activeAudio.pause()
      this._activeAudio.currentTime = 0
      this._activeAudio = null
    }
    // Only cancel speech this announcer started — the reader's Web Speech
    // fallback shares the same global queue and must not be killed by UI prompts.
    if (this._usedSynth && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      this._usedSynth = false
    }
    if (cancel) cancel()
  }
}

export const announcer = new AnnouncerService()
