package expo.modules.songkhemdocscan

import android.view.KeyEvent
import android.view.Window

/**
 * Lets the phone's volume buttons work as the shutter while the camera is open. It sits in front of the window's
 * own key handling and takes volume presses, so they take a photo instead of changing the volume. Everything else
 * passes straight through to the activity.
 */
internal class VolumeKeyCatcher(val inner: Window.Callback, private val onPress: () -> Unit) : Window.Callback by inner {
  var active = true

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val isVolume = event.keyCode == KeyEvent.KEYCODE_VOLUME_UP || event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
    if (!active || !isVolume) return inner.dispatchKeyEvent(event)
    // One photo per press: holding the button down does not keep firing
    if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) onPress()
    return true
  }
}
