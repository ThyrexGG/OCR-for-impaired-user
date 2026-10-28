import { useEffect, useRef, useState } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { goToTab, useTour } from '../context/TourContext'
import { TOUR_OFFER } from '../services/tourSteps'
import AccessiblePressable from './AccessiblePressable'

const DIM = 'rgba(8,12,24,0.78)'
const HALO = '#FACC15'
const HALO_PAD = 6
const CARD_ROOM = 230 // the least space a card needs above or below the control
const FIND_ATTEMPTS = 25
const FALLBACK_AFTER = 15

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Where a view is in the window; null if it is not laid out (or never answers, e.g. detached)
const measure = (node) =>
  new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null)
    const timer = setTimeout(() => resolve(null), 400)
    node.measureInWindow((x, y, w, h) => {
      clearTimeout(timer)
      resolve([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0 ? { x, y, w, h } : null)
    })
  })

/**
 * Dims the app, rings one control, and explains it in a card. Sits on top of the tabs (MainTabs) so it can
 * walk across screens; the tour moves to each step's tab, waits for its control to appear, and measures it.
 * Taps outside the card do nothing, so nobody triggers the camera or deletes a file by accident mid-tour.
 */
export default function TourOverlay() {
  const { colors, fonts, currentTheme } = useTheme()
  const { announce } = useApp()
  const insets = useSafeAreaInsets()
  const { phase, steps, index, getTarget, startTour, endTour, dismissOffer, next, prev, skipStep, ensureDocument } = useTour()
  const s = colors.surfaces
  const styles = createStyles(s, currentTheme)

  const rootRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState(null)
  const lastTab = useRef(null)

  const step = phase === 'tour' ? steps[index] : null

  // Find the control for the current step, then show it. A step whose control never appears is skipped.
  useEffect(() => {
    if (!step) {
      setRect(null)
      return
    }
    let cancelled = false
    setRect(null)

    const locate = async () => {
      if (lastTab.current !== step.tab) {
        goToTab(step.tab)
        await sleep(280)
      }
      lastTab.current = step.tab
      if (step.needsDocument) ensureDocument()

      for (let attempt = 0; attempt < FIND_ATTEMPTS && !cancelled; attempt++) {
        const ids = attempt < FALLBACK_AFTER ? [step.target] : [step.target, step.fallback].filter(Boolean)
        for (const id of ids) {
          const first = await measure(getTarget(id))
          if (!first) continue
          // Still sliding in with the screen change? Wait until it holds still.
          await sleep(90)
          const second = await measure(getTarget(id))
          const origin = await measure(rootRef.current)
          if (!second || !origin || Math.abs(first.x - second.x) > 2 || Math.abs(first.y - second.y) > 2) continue
          const found = { x: second.x - origin.x, y: second.y - origin.y, w: second.w, h: second.h }
          const onScreen = found.y + found.h > 0 && found.y < origin.h && found.x + found.w > 0 && found.x < origin.w
          // Laid out but scrolled out of sight: waiting won't bring it into view, so pass over it now
          return onScreen ? found : null
        }
        await sleep(120)
      }
      return null
    }

    locate().then((found) => {
      if (cancelled) return
      if (found) setRect(found)
      else skipStep()
    })
    return () => {
      cancelled = true
    }
    // The step is what changes; the callbacks are stable enough not to re-run it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index])

  // Read the step aloud once it is on screen (in-app voice or the OS screen reader, whichever is on)
  useEffect(() => {
    if (step && rect) announce(`${step.titleKm}។ ${step.descKm}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect])
  useEffect(() => {
    if (phase === 'offer') announce(`${TOUR_OFFER.titleKm} ${TOUR_OFFER.descKm}`)
    else if (phase === 'closed') lastTab.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // The system back button steps back (or leaves) instead of closing the app
  useEffect(() => {
    if (phase === 'closed') return undefined
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'offer') dismissOffer()
      else if (index > 0) prev()
      else endTour()
      return true
    })
    return () => sub.remove()
  }, [phase, index, prev, endTour, dismissOffer])

  if (phase === 'closed') return null

  const Icon = step?.Icon || Sparkles
  const isLast = step && index === steps.length - 1

  const copy = step ?? TOUR_OFFER
  const card = (
    <View style={styles.card} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <View style={styles.cardHead}>
        <View style={styles.iconBox}>
          <Icon size={22} color="#FFFFFF" />
        </View>
        {step && (
          <Text style={[styles.counter, { fontFamily: fonts.khmer }]}>
            ជំហាន {index + 1} / {steps.length}
          </Text>
        )}
      </View>
      <Text style={[styles.title, { fontFamily: fonts.khmerBold }]} accessibilityRole="header">
        {copy.titleKm}
      </Text>
      <Text style={[styles.titleEn, { fontFamily: fonts.sansBold }]}>{copy.titleEn}</Text>
      <Text style={[styles.desc, { fontFamily: fonts.khmer }]}>{copy.descKm}</Text>
      <Text style={[styles.descEn, { fontFamily: fonts.sans }]}>{copy.descEn}</Text>

      {step ? (
        <View style={styles.buttons}>
          <AccessiblePressable
            style={[styles.btn, styles.btnQuiet, index === 0 && styles.btnOff]}
            accessibilityLabel="ថយក្រោយ"
            disabled={index === 0}
            onPress={prev}
          >
            <ArrowLeft size={18} color={s.onSurface} />
            <Text style={[styles.btnText, { fontFamily: fonts.khmerBold, color: s.onSurface }]}>ថយក្រោយ</Text>
          </AccessiblePressable>
          <AccessiblePressable style={[styles.btn, styles.btnQuiet]} accessibilityLabel="រំលងការណែនាំ" onPress={endTour}>
            <Text style={[styles.btnText, { fontFamily: fonts.khmerBold, color: s.onSurface }]}>រំលង</Text>
          </AccessiblePressable>
          <AccessiblePressable
            style={[styles.btn, { backgroundColor: s.primary }]}
            accessibilityLabel={isLast ? 'ចប់' : 'បន្ទាប់'}
            hapticIntensity="medium"
            onPress={next}
          >
            <Text style={[styles.btnText, { fontFamily: fonts.khmerBold, color: '#FFFFFF' }]}>{isLast ? 'ចប់' : 'បន្ទាប់'}</Text>
            {isLast ? <Check size={18} color="#FFFFFF" /> : <ArrowRight size={18} color="#FFFFFF" />}
          </AccessiblePressable>
        </View>
      ) : (
        <View style={styles.buttons}>
          <AccessiblePressable style={[styles.btn, styles.btnQuiet]} accessibilityLabel="រំលង" onPress={dismissOffer}>
            <Text style={[styles.btnText, { fontFamily: fonts.khmerBold, color: s.onSurface }]}>រំលង</Text>
          </AccessiblePressable>
          <AccessiblePressable
            style={[styles.btn, { backgroundColor: s.primary }]}
            accessibilityLabel="ចាប់ផ្តើមការណែនាំ"
            hapticIntensity="medium"
            onPress={startTour}
          >
            <Text style={[styles.btnText, { fontFamily: fonts.khmerBold, color: '#FFFFFF' }]}>ចាប់ផ្តើម</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </AccessiblePressable>
        </View>
      )}
    </View>
  )

  // The control's ring and the four dim panels around it; the card goes above or below, wherever there is room
  let dim = <View style={styles.fill} />
  let cardBox = styles.cardCenter
  let ring = null
  if (step && rect && size.w > 0) {
    const x = Math.max(0, rect.x - HALO_PAD)
    const y = Math.max(0, rect.y - HALO_PAD)
    const w = Math.min(size.w - x, rect.w + HALO_PAD * 2)
    const h = Math.min(size.h - y, rect.h + HALO_PAD * 2)
    dim = (
      <>
        <View style={[styles.dim, { left: 0, right: 0, top: 0, height: y }]} />
        <View style={[styles.dim, { left: 0, right: 0, top: y + h, bottom: 0 }]} />
        <View style={[styles.dim, { left: 0, width: x, top: y, height: h }]} />
        <View style={[styles.dim, { left: x + w, right: 0, top: y, height: h }]} />
      </>
    )
    ring = <View pointerEvents="none" style={[styles.ring, { left: x, top: y, width: w, height: h }]} />

    const below = size.h - (y + h)
    const above = y
    const wantBelow = step.dock !== 'top'
    if (wantBelow && below >= CARD_ROOM) cardBox = { top: y + h + 12 }
    else if (!wantBelow && above >= CARD_ROOM) cardBox = { bottom: size.h - y + 12 }
    else if (below >= CARD_ROOM) cardBox = { top: y + h + 12 }
    else if (above >= CARD_ROOM) cardBox = { bottom: size.h - y + 12 }
    else cardBox = { bottom: 16 + insets.bottom } // the control fills the screen: card sits over its lower edge
  }

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
    >
      {dim}
      {ring}
      {(phase === 'offer' || rect) && (
        <View pointerEvents="box-none" style={[styles.cardWrap, cardBox]}>
          {card}
        </View>
      )}
    </View>
  )
}

const createStyles = (s, theme) => {
  const surface = theme === 'dark' ? s.surface1 : '#FFFFFF'
  return StyleSheet.create({
    root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, elevation: 50 },
    fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: DIM },
    dim: { position: 'absolute', backgroundColor: DIM },
    // Nearly square: the dim panels around it are straight-edged, so a round ring would leave bright corners
    ring: { position: 'absolute', borderWidth: 3, borderColor: HALO, borderRadius: 6 },
    cardWrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 12, alignItems: 'center' },
    cardCenter: { top: 0, bottom: 0, justifyContent: 'center' },
    card: {
      width: '100%',
      maxWidth: 460,
      padding: 18,
      gap: 6,
      borderRadius: 22,
      backgroundColor: surface,
      borderWidth: 1.5,
      borderColor: s.divider,
      elevation: 12,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: s.primary },
    counter: { fontSize: 14, color: s.onSurfaceMuted },
    title: { fontSize: 20, lineHeight: 30, color: s.onSurface },
    titleEn: { fontSize: 15, color: s.onSurfaceMuted },
    desc: { fontSize: 16, lineHeight: 27, color: s.onSurface, marginTop: 4 },
    descEn: { fontSize: 14, lineHeight: 21, color: s.onSurfaceMuted },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
    btn: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 24, paddingHorizontal: 10 },
    btnQuiet: { backgroundColor: theme === 'dark' ? s.surface2 : '#F1F5F9' },
    btnOff: { opacity: 0.4 },
    btnText: { fontSize: 15 },
  })
}
