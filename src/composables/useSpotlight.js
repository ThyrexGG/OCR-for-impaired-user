import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

/**
 * SOLID (Single Responsibility Principle & DRY):
 * Encapsulates DOM element tracking, viewport bounds calculation,
 * and adaptive docking positioning (Top vs Bottom).
 */
export function useSpotlight(targetSelectorGetter, preferredDockGetter = () => 'bottom', padding = 8) {
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
      spotlightRect.value = {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        right: rect.right + padding,
        bottom: rect.bottom + padding
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
