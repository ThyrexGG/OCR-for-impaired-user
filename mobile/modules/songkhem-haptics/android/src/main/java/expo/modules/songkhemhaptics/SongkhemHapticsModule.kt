package expo.modules.songkhemhaptics

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Vibrates with an explicit "accessibility" purpose.
 *
 * React Native's Vibration and expo-haptics both vibrate with no declared purpose, which Android files under
 * USAGE_UNKNOWN. Phones with "Touch feedback" switched off (Xiaomi / HyperOS ship this way) silently drop every
 * such vibration, so the app's feedback never reached the user. Accessibility vibrations are not tied to that
 * switch, and they are exactly what this app's haptics are.
 */
class SongkhemHapticsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val vibrator: Vibrator
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

  private val attributes: AudioAttributes =
    AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

  override fun definition() = ModuleDefinition {
    Name("SongkhemHaptics")

    // pattern: [wait, buzz, wait, buzz, ...] in milliseconds, the same shape React Native's Vibration takes
    Function("vibrate") { pattern: List<Double> ->
      val timings = pattern.map { it.toLong() }.toLongArray()
      if (timings.isNotEmpty() && vibrator.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          @Suppress("DEPRECATION")
          vibrator.vibrate(VibrationEffect.createWaveform(timings, -1), attributes)
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(timings, -1, attributes)
        }
      }
    }
  }
}
