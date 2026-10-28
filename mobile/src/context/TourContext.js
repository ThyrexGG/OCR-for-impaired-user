import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { navigationRef } from '../navigation/navigationRef'
import { sampleLibrary } from '../services/sampleLibrary'
import { TOUR_STEPS } from '../services/tourSteps'
import { useOcr } from './OcrContext'

const SEEN_KEY = 'songkhem_tour_seen'
const TABS = ['Camera', 'Upload', 'Reader', 'Recent']

const TourContext = createContext(null)

// Screens call useTourTarget() even where no provider is mounted (and tests may render them alone)
const IDLE = {
  phase: 'closed',
  isTourActive: false,
  steps: TOUR_STEPS,
  index: 0,
  registerTarget: () => () => {},
  getTarget: () => null,
  startTour: () => {},
  endTour: () => {},
  dismissOffer: () => {},
  offerIfFirstTime: () => {},
  next: () => {},
  prev: () => {},
  skipStep: () => {},
  ensureDocument: () => {},
}

export const goToTab = (name) => {
  if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: name })
}

/**
 * The guided tour: which step we are on, and a registry of the on-screen controls it can point at.
 * Phases: 'closed', 'offer' (first launch: "want a tour?"), 'tour' (stepping through TOUR_STEPS).
 */
export function TourProvider({ children }) {
  const { extractedText, historyList, openSampleQuietly, discardTourSample } = useOcr()
  const [phase, setPhase] = useState('closed')
  const [index, setIndex] = useState(0)

  const targets = useRef(new Map())
  const originTab = useRef('Camera')
  const direction = useRef(1)
  const hasText = useRef(false)
  hasText.current = !!extractedText
  const historyIds = useRef([])
  historyIds.current = historyList.map((item) => item.id)
  // Set when the tour had to open a sample itself: what the history held before, so it can be put back
  const tourSample = useRef(null)

  // A callback ref per control id: it keeps the registry current as screens mount and unmount
  const registerTarget = useCallback(
    (id) => (node) => {
      if (node) targets.current.set(id, node)
      else targets.current.delete(id)
    },
    []
  )
  const getTarget = useCallback((id) => targets.current.get(id) || null, [])

  const markSeen = useCallback(() => {
    AsyncStorage.setItem(SEEN_KEY, 'true').catch(() => {})
  }, [])

  const offerIfFirstTime = useCallback(async () => {
    try {
      if ((await AsyncStorage.getItem(SEEN_KEY)) === 'true') return
    } catch (e) {
      return
    }
    setPhase((p) => (p === 'closed' ? 'offer' : p))
  }, [])

  const dismissOffer = useCallback(() => {
    setPhase('closed')
    markSeen()
  }, [markSeen])

  const startTour = useCallback(() => {
    const here = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null
    originTab.current = TABS.includes(here) ? here : 'Camera'
    direction.current = 1
    setIndex(0)
    setPhase('tour')
    markSeen()
  }, [markSeen])

  // Back to the tab the user started from
  const endTour = useCallback(() => {
    setPhase('closed')
    markSeen()
    goToTab(originTab.current)
    if (tourSample.current) {
      discardTourSample(tourSample.current.before)
      tourSample.current = null
    }
  }, [markSeen, discardTourSample])

  const goTo = useCallback(
    (i, dir) => {
      if (i >= TOUR_STEPS.length) return endTour()
      direction.current = dir
      setIndex(Math.max(0, i))
    },
    [endTour]
  )
  const next = useCallback(() => goTo(index + 1, 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1, -1), [goTo, index])
  // A step whose control isn't on screen is passed over, in whichever direction the user was going
  const skipStep = useCallback(() => goTo(index + direction.current, direction.current), [goTo, index])

  // The reader steps need text open; open a sample quietly (no toast, voice or auto-read over the tour)
  const ensureDocument = useCallback(() => {
    if (hasText.current || tourSample.current) return
    tourSample.current = { before: historyIds.current }
    openSampleQuietly(sampleLibrary[0])
  }, [openSampleQuietly])

  const value = useMemo(
    () => ({
      phase,
      isTourActive: phase === 'tour',
      steps: TOUR_STEPS,
      index,
      registerTarget,
      getTarget,
      startTour,
      endTour,
      dismissOffer,
      offerIfFirstTime,
      next,
      prev,
      skipStep,
      ensureDocument,
    }),
    [phase, index, registerTarget, getTarget, startTour, endTour, dismissOffer, offerIfFirstTime, next, prev, skipStep, ensureDocument]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  return useContext(TourContext) || IDLE
}

// Attach the returned callback to a control (`ref={...}`, plus collapsable={false} on a plain View) so the
// tour can find where it is on screen.
export function useTourTarget(id) {
  const { registerTarget } = useTour()
  return useMemo(() => registerTarget(id), [registerTarget, id])
}
