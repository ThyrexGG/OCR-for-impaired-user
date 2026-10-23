import { useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useApp } from '../context/AppContext'

/**
 * Says what a screen is (and what to do on it) each time it comes into focus, so a user who
 * cannot see it always knows where they are. `getMessage` may return a string, an array of
 * segments, or nothing; it is read when the screen focuses, not re-run when its inputs change.
 */
export default function useScreenIntro(getMessage, { interrupt = true } = {}) {
  const { speakAccessibility, prefsLoaded } = useApp()
  const latest = useRef(getMessage)
  latest.current = getMessage

  useFocusEffect(
    useCallback(() => {
      if (!prefsLoaded) return
      const message = latest.current()
      if (message) speakAccessibility(message, interrupt)
    }, [prefsLoaded, speakAccessibility, interrupt])
  )
}
