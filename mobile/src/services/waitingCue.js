/**
 * The "working on it" sound: a soft du-du-du that loops while a scan is being read, in place of spoken
 * "please wait" messages, so the user can tell "still working" from "stuck" without words talking over them.
 * The sound is generated, not recorded: three short tones and a pause (assets/sounds/waiting-cue.wav).
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'

const CUE = require('../../assets/sounds/waiting-cue.wav')

let player = null

export const startWaitingCue = () => {
  if (player) return
  try {
    Promise.resolve(setAudioModeAsync({ playsInSilentMode: true })).catch(() => {})
    player = createAudioPlayer(CUE)
    player.loop = true
    // Kept well under the spoken voice: it is a background "still working", not a message
    player.volume = 0.35
    player.play()
  } catch (e) {
    stopWaitingCue()
  }
}

export const stopWaitingCue = () => {
  const current = player
  player = null
  if (!current) return
  try { current.pause() } catch (e) {}
  try { current.remove() } catch (e) {}
}
