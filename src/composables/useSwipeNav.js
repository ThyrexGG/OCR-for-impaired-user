/**
 * Composable for swipe/drag navigation between modes/views.
 * Supports single-finger touch gestures and mouse pointer gestures.
 */
export function useSwipeNav({ onSwipeLeft, onSwipeRight, threshold = 40, maxTime = 700 } = {}) {
  let touchStartX = 0
  let touchStartY = 0
  let touchStartTime = 0

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
      touchStartTime = Date.now()
    }
  }

  const onTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return
    const deltaX = e.changedTouches[0].clientX - touchStartX
    const deltaY = e.changedTouches[0].clientY - touchStartY
    const deltaTime = Date.now() - touchStartTime

    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < maxTime) {
      if (deltaX < -threshold) {
        onSwipeLeft?.()
      } else if (deltaX > threshold) {
        onSwipeRight?.()
      }
    }
  }

  let pointerStartX = 0
  let pointerStartY = 0
  let pointerStartTime = 0
  let isDragging = false

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('button, input, a, select, textarea, [role="button"]')) return
    pointerStartX = e.clientX
    pointerStartY = e.clientY
    pointerStartTime = Date.now()
    isDragging = true
  }

  const onPointerUp = (e) => {
    if (!isDragging) return
    isDragging = false
    const deltaX = e.clientX - pointerStartX
    const deltaY = e.clientY - pointerStartY
    const deltaTime = Date.now() - pointerStartTime

    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < maxTime) {
      if (deltaX < -threshold) {
        onSwipeLeft?.()
      } else if (deltaX > threshold) {
        onSwipeRight?.()
      }
    }
  }

  return {
    onTouchStart,
    onTouchEnd,
    onPointerDown,
    onPointerUp
  }
}

