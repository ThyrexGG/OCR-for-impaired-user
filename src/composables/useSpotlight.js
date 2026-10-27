import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * SOLID (Single Responsibility Principle & DRY):
 * Encapsulates DOM element tracking, viewport bounds calculation,
 * dynamic shape/border-radius matching (circle vs pill vs rectangle),
 * and adaptive docking positioning (Top vs Bottom).
 */
export function useSpotlight(targetSelectorGetter, preferredDockGetter = () => 'bottom', defaultPadding = 4) {
  const spotlightRect = ref(null)
  const dockPosition = ref('bottom')

  const updatePosition = () => {
    const selector = typeof targetSelectorGetter === 'function' ? targetSelectorGetter() : targetSelectorGetter
    if (!selector) {
      spotlightRect.value = null
      dockPosition.value = typeof preferredDockGetter === 'function' ? preferredDockGetter() : preferredDockGetter
      return
    }

    const targetEl = document.querySelector(selector)
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(targetEl)
      
      // Read corner radius reliably across browsers (shorthand borderRadius returns "" in Chromium)
      const rTL = parseFloat(computedStyle.borderTopLeftRadius) || 0
      const rTR = parseFloat(computedStyle.borderTopRightRadius) || 0
      const rBR = parseFloat(computedStyle.borderBottomRightRadius) || 0
      const rBL = parseFloat(computedStyle.borderBottomLeftRadius) || 0
      const cornerRadius = Math.max(rTL, rTR, rBR, rBL) || parseFloat(computedStyle.borderRadius) || 0

      // Detect docked bottom navigation bar (must be full width, no bottom curve, 0 pad)
      const isBottomBar = targetEl.classList.contains('bottom-nav-bar') ||
        (rect.bottom >= window.innerHeight - 8 && rect.width >= window.innerWidth * 0.75)

      if (isBottomBar) {
        const top = Math.round(rect.top)
        const left = 0
        const width = window.innerWidth
        const height = Math.round(window.innerHeight - rect.top)
        
        spotlightRect.value = {
          top,
          left,
          width,
          height,
          rx: 0,
          ry: 0,
          borderRadius: '0px',
          right: width,
          bottom: window.innerHeight
        }
        dockPosition.value = 'top'
        return
      }

      const minDimension = Math.min(rect.width, rect.height)
      const isNearlySquare = Math.abs(rect.width - rect.height) <= 6
      const isHeaderBtn = targetEl.classList.contains('header-btn')

      // Detect circular elements vs pills vs cards
      const isPillOrCircle = cornerRadius >= (minDimension / 2 - 4) || isHeaderBtn
      const isCircle = isPillOrCircle && isNearlySquare
      const isPill = isPillOrCircle && !isNearlySquare

      // For circular buttons or tight header controls, use 0px pad so spotlight hugs the button exactly and never overlaps neighbors
      let pad = defaultPadding || 4
      if (isCircle || (rect.width <= 56 && rect.height <= 56)) {
        pad = 0
      } else if (isPill) {
        pad = 1
      }

      const width = Math.round(rect.width + pad * 2)
      const height = Math.round(rect.height + pad * 2)
      const top = Math.max(0, Math.round(rect.top - pad))
      const left = Math.max(0, Math.round(rect.left - pad))

      // Shape-aware radius for SVG mask and CSS halo
      let rx = 8
      let ry = 8
      let borderRadius = '8px'

      if (isCircle) {
        rx = Math.round(width / 2)
        ry = Math.round(height / 2)
        borderRadius = '50%'
      } else if (isPill) {
        rx = Math.round(height / 2)
        ry = Math.round(height / 2)
        borderRadius = `${rx}px`
      } else if (cornerRadius > 0) {
        rx = Math.min(Math.round(cornerRadius + pad), 24)
        ry = rx
        borderRadius = `${rx}px`
      } else {
        rx = 0
        ry = 0
        borderRadius = '0px'
      }

      spotlightRect.value = {
        top,
        left,
        width,
        height,
        rx,
        ry,
        borderRadius,
        right: left + width,
        bottom: top + height
      }

      // If target is in the bottom half of viewport, dock sheet to the top
      if (rect.top > window.innerHeight * 0.45) {
        dockPosition.value = 'top'
      } else {
        dockPosition.value = 'bottom'
      }
    } else {
      spotlightRect.value = null
      dockPosition.value = typeof preferredDockGetter === 'function' ? preferredDockGetter() : preferredDockGetter
    }
  }

  const scrollTargetIntoView = () => {
    const selector = typeof targetSelectorGetter === 'function' ? targetSelectorGetter() : targetSelectorGetter
    if (!selector) return
    const el = document.querySelector(selector)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  onMounted(() => {
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
  })

  return {
    spotlightRect,
    dockPosition,
    updatePosition,
    scrollTargetIntoView
  }
}
