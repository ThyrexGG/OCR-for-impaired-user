/**
 * The "working on it" sound, same as the app: a soft du-du-du that loops while a scan is being read, in place
 * of spoken "please wait" messages, so the user can tell "still working" from "stuck" without words talking
 * over them. The sound is generated, not recorded (public/sounds/waiting-cue.wav).
 */
let audio = null

export const startWaitingCue = () => {
  if (audio || typeof Audio === 'undefined') return
  try {
    audio = new Audio('/sounds/waiting-cue.wav')
    audio.loop = true
    // Kept well under the spoken voice: it is a background "still working", not a message
    audio.volume = 0.35
    const played = audio.play()
    if (played && played.catch) played.catch(() => stopWaitingCue())
  } catch (e) {
    stopWaitingCue()
  }
}

export const stopWaitingCue = () => {
  if (!audio) return
  try {
    audio.pause()
    audio.src = ''
  } catch (e) {}
  audio = null
}
