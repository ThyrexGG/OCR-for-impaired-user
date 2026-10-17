/**
 * Announcer Service (Port & Adapter)
 * Conforms to .agents/ProjectInstruction.md §5.2 & §6.2
 * Single Responsibility: Delivers screen-reader announcements and audible UI guidance.
 */

import { currentLang } from './i18n'
import { synthesizeLocalKhmerTTS } from './tts'

class AnnouncerService {
  constructor() {
    this._isVoiceEnabled = false
    this._liveRegionPolite = null
    this._liveRegionAssertive = null
    this._lastMessage = ''
    this._lastSpokenTime = 0
    this._throttleMs = 1500
    this._audioCache = new Map()
    this._activeAudio = null
  }

  setVoiceEnabled(enabled) {
    this._isVoiceEnabled = Boolean(enabled)
  }

  isVoiceEnabled() {
    return this._isVoiceEnabled
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

  /**
   * Speak audible UI guidance (for users without OS screen reader)
   * Throttles identical messages per §6.2
   * @param {string} text
   * @param {boolean} interrupt
   */
  async speak(text, interrupt = true) {
    if (!text || typeof window === 'undefined') return

    const now = Date.now()
    if (text === this._lastMessage && now - this._lastSpokenTime < this._throttleMs) {
      return
    }

    this._lastMessage = text
    this._lastSpokenTime = now

    // Always update screen reader live region first
    this.announce(text, interrupt ? 'assertive' : 'polite')

    // Only speak aloud if self-contained voice guidance is turned ON
    if (!this._isVoiceEnabled) return

    if (interrupt) {
      this.stop()
    }

    const hasKhmer = /[\u1780-\u17ff]/.test(text) || currentLang.value === 'km'
    if (hasKhmer) {
      try {
        let blobUrl = this._audioCache.get(text)
        if (!blobUrl) {
          blobUrl = await synthesizeLocalKhmerTTS(text, 'km-KH-SreymomNeural', 1.0)
          this._audioCache.set(text, blobUrl)
        }
        const audio = new Audio(blobUrl)
        this._activeAudio = audio
        audio.play().catch(() => {})
        return
      } catch (_) {
        // Fallback to speechSynthesis below if local server is offline
      }
    }

    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.lang = currentLang.value === 'km' ? 'km-KH' : 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  }

  stop() {
    if (this._activeAudio) {
      this._activeAudio.pause()
      this._activeAudio.currentTime = 0
      this._activeAudio = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }
}

export const announcer = new AnnouncerService()
