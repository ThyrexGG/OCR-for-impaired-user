/**
 * Hands-Free Voice Commands Service for songKHEM
 * Enables visually impaired users to operate the app using Khmer and English voice commands.
 */

const SpeechRecognition = typeof window !== 'undefined' 
  ? (window.SpeechRecognition || window.webkitSpeechRecognition) 
  : null

class VoiceCommandService {
  constructor() {
    this.recognition = null
    this.isListening = false
    this.onCommandCallback = null
    this.onErrorCallback = null
    this.lang = 'km-KH'

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = false
      this.recognition.lang = 'km-KH'

      this.recognition.onresult = (event) => {
        const lastResultIndex = event.results.length - 1
        const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase()
        this.processTranscript(transcript)
      }

      this.recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && this.onErrorCallback) {
          this.onErrorCallback(event.error)
        }
      }

      this.recognition.onend = () => {
        // Automatically restart if user hasn't explicitly stopped listening
        if (this.isListening) {
          try {
            this.recognition.start()
          } catch (e) {}
        }
      }
    }
  }

  isSupported() {
    return !!SpeechRecognition
  }

  setLanguage(langCode) {
    this.lang = langCode === 'km' ? 'km-KH' : 'en-US'
    if (this.recognition) {
      this.recognition.lang = this.lang
    }
  }

  start(onCommand, onError) {
    if (!this.recognition) return false
    this.onCommandCallback = onCommand
    this.onErrorCallback = onError
    this.isListening = true
    try {
      this.recognition.start()
      return true
    } catch (e) {
      return false
    }
  }

  stop() {
    this.isListening = false
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch (e) {}
    }
  }

  toggle(onCommand, onError) {
    if (this.isListening) {
      this.stop()
      return false
    } else {
      return this.start(onCommand, onError)
    }
  }

  processTranscript(transcript) {
    if (!this.onCommandCallback || !transcript) return

    // 0. SKIP FORWARD / BACK (checked first so "skip" / "back" never fall through to play/stop)
    if (
      transcript.includes('ទៅមុខ') ||
      transcript.includes('រំលង') ||
      transcript.includes('forward') ||
      transcript.includes('skip') ||
      transcript.includes('next')
    ) {
      this.onCommandCallback({ action: 'skip-forward', transcript })
      return
    }
    if (
      transcript.includes('ថយក្រោយ') ||
      transcript.includes('ត្រឡប់ក្រោយ') ||
      transcript.includes('rewind') ||
      transcript.includes('go back') ||
      transcript.includes('previous') ||
      transcript === 'back'
    ) {
      this.onCommandCallback({ action: 'skip-back', transcript })
      return
    }

    // 1. PLAY / READ ALOUD
    if (
      transcript.includes('អាន') || 
      transcript.includes('លេង') || 
      transcript.includes('play') || 
      transcript.includes('read')
    ) {
      this.onCommandCallback({ action: 'play', transcript })
      return
    }

    // 2. STOP / PAUSE
    if (
      transcript.includes('ឈប់') || 
      transcript.includes('ផ្អាក') || 
      transcript.includes('stop') || 
      transcript.includes('pause')
    ) {
      this.onCommandCallback({ action: 'stop', transcript })
      return
    }

    // 3. FASTER
    if (
      transcript.includes('លឿន') || 
      transcript.includes('faster') || 
      transcript.includes('speed up')
    ) {
      this.onCommandCallback({ action: 'faster', transcript })
      return
    }

    // 4. SLOWER
    if (
      transcript.includes('យឺត') || 
      transcript.includes('slower') || 
      transcript.includes('slow down')
    ) {
      this.onCommandCallback({ action: 'slower', transcript })
      return
    }

    // 5. SCAN / CAPTURE
    if (
      transcript.includes('ស្កេន') || 
      transcript.includes('ថត') || 
      transcript.includes('scan') || 
      transcript.includes('capture')
    ) {
      this.onCommandCallback({ action: 'scan', transcript })
      return
    }

    // 6. HELP / SETTINGS
    if (
      transcript.includes('ជំនួយ') || 
      transcript.includes('help')
    ) {
      this.onCommandCallback({ action: 'help', transcript })
      return
    }
  }
}

export const voiceCommands = new VoiceCommandService()
