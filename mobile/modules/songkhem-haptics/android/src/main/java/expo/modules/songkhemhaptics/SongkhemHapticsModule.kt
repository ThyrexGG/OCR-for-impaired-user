package expo.modules.songkhemhaptics

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Vibrates with an explicit "accessibility" purpose, using the phone's own built-in haptic effects.
 *
 * React Native's Vibration and expo-haptics both vibrate with no declared purpose, which Android files under
 * USAGE_UNKNOWN. Phones with "Touch feedback" switched off (Xiaomi / HyperOS ship this way) silently drop every
 * such vibration, so the app's feedback never reached the user. Accessibility vibrations are not tied to that
 * switch, and they are exactly what this app's haptics are.
 *
 * Linear-motor phones (the Redmi Note 14 Pro+ here) also render plain "buzz for N ms" vibrations as nothing
 * you can feel, while the built-in click / tick effects are crisp, so effects are preferred over buzzes.
 */
class SongkhemHapticsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val handler = Handler(Looper.getMainLooper())

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

  @Suppress("DEPRECATION")
  private fun play(effect: VibrationEffect) = vibrator.vibrate(effect, attributes)

  override fun definition() = ModuleDefinition {
    Name("SongkhemHaptics")

    // pattern: [wait, buzz, wait, buzz, ...] in milliseconds, the same shape React Native's Vibration takes
    Function("vibrate") { pattern: List<Double> ->
      val timings = pattern.map { it.toLong() }.toLongArray()
      if (timings.isNotEmpty() && vibrator.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          play(VibrationEffect.createWaveform(timings, -1))
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(timings, -1, attributes)
        }
      }
    }

    // steps: [effectId, startMs] pairs. effectId is android.os.VibrationEffect's EFFECT_*
    // (0 click, 1 double click, 2 tick, 3 thud, 4 pop, 5 heavy click). Returns false when unsupported.
    Function("playEffects") { steps: List<List<Double>> ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || steps.isEmpty() || !vibrator.hasVibrator()) {
        return@Function false
      }
      val ids = steps.map { it[0].toInt() }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
        vibrator.areAllEffectsSupported(*ids.toIntArray()) != Vibrator.VIBRATION_EFFECT_SUPPORT_YES
      ) {
        return@Function false
      }
      handler.removeCallbacksAndMessages(null)
      steps.forEach { step ->
        val effect = VibrationEffect.createPredefined(step[0].toInt())
        val at = step[1].toLong()
        if (at <= 0L) play(effect) else handler.postDelayed({ play(effect) }, at)
      }
      true
    }
  }
}
