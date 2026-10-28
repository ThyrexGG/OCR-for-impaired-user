import { useEffect, useRef, useState } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, Mask, Rect } from 'react-native-svg'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { goToTab, useTour } from '../context/TourContext'
import { TOUR_OFFER } from '../services/tourSteps'
import AccessiblePressable from './AccessiblePressable'

const DIM = 'rgba(11,18,32,0.65)'
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
 * Dims the app, rings one control, and explains it in a card docked to the top or bottom (the website's FeatureGuidelines). Sits on top of the tabs (MainTabs) so it can
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

  // ---- First launch: the website's welcome dialog (WelcomeOverlay.vue) ----
  if (phase === 'offer') {
    const w = WELCOME[currentTheme] || WELCOME.light
    return (
      <View ref={rootRef} collapsable={false} style={[styles.root, styles.scrim]} onStartShouldSetResponder={() => true}>
        <View style={[styles.welcome, { backgroundColor: w.bg, borderColor: w.border || 'transparent', borderWidth: w.border ? 3 : 0 }]} accessibilityViewIsModal>
          <Text style={[styles.welcomeTitle, { color: w.title, fontFamily: fonts.khmerBold }]} accessibilityRole="header">
            {TOUR_OFFER.titleKm}
          </Text>
          <Text style={[styles.welcomeSub, { color: w.sub, fontFamily: fonts.khmer }]}>{TOUR_OFFER.descKm}</Text>
          <View style={styles.featureList}>
            {TOUR_OFFER.features.map(({ Icon: FeatureIcon, titleKm, descKm }) => (
              <View key={titleKm} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: w.iconBg }]}>
                  <FeatureIcon size={20} color={w.icon} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={[styles.featureTitle, { color: w.title, fontFamily: fonts.khmerBold }]}>{titleKm}</Text>
                  <Text style={[styles.featureDesc, { color: w.desc, fontFamily: fonts.khmer }]}>{descKm}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.welcomeActions}>
            <AccessiblePressable style={[styles.welcomeBtn, { backgroundColor: w.primary }]} accessibilityLabel="ចាប់ផ្តើមការណែនាំ" hapticIntensity="medium" onPress={startTour}>
              <Text style={[styles.welcomeBtnText, { color: w.onPrimary, fontFamily: fonts.khmerBold }]}>ចាប់ផ្តើមការណែនាំ</Text>
            </AccessiblePressable>
            <AccessiblePressable style={styles.welcomeBtn} accessibilityLabel="រំលង" onPress={dismissOffer}>
              <Text style={[styles.welcomeBtnText, { color: w.text, fontFamily: fonts.khmerBold }]}>រំលង</Text>
            </AccessiblePressable>
          </View>
        </View>
      </View>
    )
  }

  // ---- Tour step: the website's spotlight (FeatureGuidelines.vue + useSpotlight.js) ----
  const isContrast = currentTheme === 'contrast'
  const ringColor = isContrast ? '#FFFF00' : s.primary
  const Icon = step?.Icon || Sparkles
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  // Shape-aware cut-out, as on the website: small / round controls are hugged exactly, cards get 4px and soft corners
  let hole = null
  if (rect && size.w > 0) {
    const small = rect.w <= 56 && rect.h <= 56
    const nearlySquare = Math.abs(rect.w - rect.h) <= 6
    const pad = small || nearlySquare ? 0 : 4
    const x = Math.max(0, rect.x - pad)
    const y = Math.max(0, rect.y - pad)
    const width = Math.min(size.w - x, rect.w + pad * 2)
    const height = Math.min(size.h - y, rect.h + pad * 2)
    const radius = nearlySquare && width <= 96 ? width / 2 : 12
    hole = { x, y, width, height, radius }
  }
  // The card docks to the top of the screen when the control is in the lower part, else to the bottom
  const dockTop = hole ? hole.y > size.h * 0.45 : false

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tourCutout" x="0" y="0" width={size.w || 1} height={size.h || 1} maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={size.w || 1} height={size.h || 1} fill="#FFFFFF" />
            {hole && <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={hole.radius} ry={hole.radius} fill="#000000" />}
          </Mask>
        </Defs>
        <Rect x="0" y="0" width={size.w || 1} height={size.h || 1} fill={DIM} mask="url(#tourCutout)" />
      </Svg>
      {hole && (
        <View
          pointerEvents="none"
          style={[styles.halo, { left: hole.x, top: hole.y, width: hole.width, height: hole.height, borderRadius: hole.radius, borderColor: ringColor, shadowColor: ringColor }]}
        />
      )}

      {step && rect && (
        <View
          pointerEvents="box-none"
          style={[styles.dock, dockTop ? { top: 0, paddingTop: Math.max(16, insets.top) } : { bottom: 0, paddingBottom: Math.max(16, insets.bottom + 8) }]}
        >
          <View style={[styles.card, isContrast && styles.cardContrast]} accessibilityViewIsModal accessibilityLiveRegion="polite">
            <View style={styles.cardHead}>
              <View style={[styles.badge, isContrast && styles.badgeContrast]}>
                <Text style={[styles.badgeText, isContrast && { color: '#FFFF00' }]}>
                  {index + 1} / {steps.length}
                </Text>
              </View>
              <Icon size={20} color={isContrast ? '#FFFF00' : s.primary} />
              <Text style={[styles.title, { fontFamily: fonts.khmerBold }, isContrast && { color: '#FFFFFF' }]} accessibilityRole="header">
                {step.titleKm}
              </Text>
            </View>
            <Text style={[styles.desc, { fontFamily: fonts.khmer }, isContrast && { color: '#FFFFFF' }]}>{step.descKm}</Text>

            <View style={styles.footer}>
              <AccessiblePressable style={styles.skipBtn} accessibilityLabel="រំលងការណែនាំ" onPress={endTour}>
                <Text style={[styles.skipText, { fontFamily: fonts.khmer }, isContrast && { color: '#FFFF00' }]}>រំលង</Text>
              </AccessiblePressable>
              <View style={styles.navGroup}>
                <AccessiblePressable
                  style={[styles.actionBtn, styles.prevBtn, isContrast && styles.prevBtnContrast, isFirst && styles.btnOff]}
                  accessibilityLabel="ថយក្រោយ (ជំហានមុន)"
                  disabled={isFirst}
                  onPress={prev}
                >
                  <ArrowLeft size={18} color={isContrast ? '#FFFFFF' : s.onTonal} />
                  <Text style={[styles.actionText, { fontFamily: fonts.khmerBold, color: isContrast ? '#FFFFFF' : s.onTonal }]}>ថយក្រោយ</Text>
                </AccessiblePressable>
                <AccessiblePressable
                  style={[styles.actionBtn, styles.nextBtn, isContrast && styles.nextBtnContrast]}
                  accessibilityLabel={isLast ? 'បញ្ចប់ការណែនាំ' : 'បន្តទៅមុខ'}
                  hapticIntensity="medium"
                  onPress={next}
                >
                  <Text style={[styles.actionText, { fontFamily: fonts.khmerBold, color: isContrast ? '#000000' : s.onPrimary }]}>{isLast ? 'បញ្ចប់' : 'បន្ត'}</Text>
                  {isLast ? <Check size={18} color={isContrast ? '#000000' : s.onPrimary} /> : <ArrowRight size={18} color={isContrast ? '#000000' : s.onPrimary} />}
                </AccessiblePressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

// WelcomeOverlay.css per theme
const WELCOME = {
  light: { bg: '#FFFFFF', border: null, title: '#1F1F1F', sub: '#444746', desc: '#5E5E5E', iconBg: '#F0F4F9', icon: '#0B57D0', primary: '#0B57D0', onPrimary: '#FFFFFF', text: '#0B57D0' },
  dark: { bg: '#1E1F22', border: null, title: '#E3E3E3', sub: '#C4C7C5', desc: '#9AA0A6', iconBg: '#2A2B2F', icon: '#A8C7FA', primary: '#A8C7FA', onPrimary: '#062E6F', text: '#A8C7FA' },
  contrast: { bg: '#000000', border: '#FFFF00', title: '#FFFF00', sub: '#FFFFFF', desc: '#FFFFFF', iconBg: '#FFFF00', icon: '#000000', primary: '#FFFF00', onPrimary: '#000000', text: '#FFFF00' },
}

const createStyles = (s, theme) => {
  const surface = theme === 'dark' ? s.surface1 : theme === 'contrast' ? '#000000' : '#FFFFFF'
  return StyleSheet.create({
    root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, elevation: 50 },
    // Welcome dialog
    scrim: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    welcome: { width: '100%', maxWidth: 440, borderRadius: 28, paddingTop: 28, paddingHorizontal: 24, paddingBottom: 20, gap: 16, elevation: 12 },
    welcomeTitle: { fontSize: 21.6, lineHeight: 30, fontWeight: '600' },
    welcomeSub: { fontSize: 14.7, lineHeight: 22 },
    featureList: { gap: 14, marginTop: 4, marginBottom: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    featureIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    featureCopy: { flex: 1, gap: 2, paddingTop: 1 },
    featureTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
    featureDesc: { fontSize: 12.8, lineHeight: 18 },
    welcomeActions: { gap: 6, marginTop: 8 },
    welcomeBtn: { minHeight: 44, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
    welcomeBtnText: { fontSize: 14.7, fontWeight: '600' },
    // Spotlight
    halo: { position: 'absolute', borderWidth: 3, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
    dock: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, alignItems: 'center' },
    card: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: surface,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 18,
      gap: 10,
      elevation: 12,
      shadowColor: '#0B1220',
      shadowOpacity: 0.22,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 10 },
    },
    cardContrast: { borderWidth: 3, borderColor: '#FFFF00' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999, backgroundColor: s.surface2 },
    badgeContrast: { backgroundColor: '#000000', borderWidth: 1, borderColor: '#FFFF00' },
    badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.24, color: s.onTonal },
    title: { flexShrink: 1, fontSize: 16.8, lineHeight: 24, fontWeight: '700', color: s.onSurface },
    desc: { fontSize: 15, lineHeight: 24, fontWeight: '500', color: s.onSurface },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: s.divider },
    skipBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 10 },
    skipText: { fontSize: 14, color: s.onSurfaceMuted, textDecorationLine: 'underline' },
    navGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 9999 },
    prevBtn: { backgroundColor: s.surface2, borderWidth: 1, borderColor: 'transparent' },
    prevBtnContrast: { backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF' },
    nextBtn: { backgroundColor: s.primary, borderWidth: 2, borderColor: s.primary },
    nextBtnContrast: { backgroundColor: '#FFFF00', borderColor: '#FFFF00' },
    btnOff: { opacity: 0.4 },
    actionText: { fontSize: 14, fontWeight: '600' },
  })
}
