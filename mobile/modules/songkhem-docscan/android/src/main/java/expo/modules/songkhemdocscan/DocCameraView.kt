package expo.modules.songkhemdocscan

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.media.MediaActionSound
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.lifecycle.awaitInstance
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.hypot
import kotlin.math.max

private const val GRID_W = 72
private const val GRID_H = 96
private const val FRAME_INTERVAL_MS = 110L
private const val MAX_OUTPUT_SIDE = 3000f
private const val VIEWPORT_RETRIES = 40
private const val SCAN_KEEP_MS = 60 * 60 * 1000L

@SuppressLint("ViewConstructor")
class DocCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onFrame by EventDispatcher()
  private val onError by EventDispatcher()

  // React Native does not lay out native children; let Android do it for this view
  override val shouldUseAndroidLayout = true

  private val previewView = PreviewView(context).apply {
    // A TextureView, so the outline React Native draws on top of the preview is composited correctly
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }
  private val mainHandler = Handler(Looper.getMainLooper())
  private val workers = Executors.newSingleThreadExecutor()
  private val scope = CoroutineScope(Dispatchers.Main)
  private var provider: ProcessCameraProvider? = null
  private var imageCapture: ImageCapture? = null
  private var lastFrameAt = 0L
  private var released = false
  // The phone's own camera click, so the user hears that the photo was taken
  private val shutterSound = MediaActionSound().apply { load(MediaActionSound.SHUTTER_CLICK) }

  init {
    addView(previewView, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    released = false
    bind(0)
  }

  override fun onDetachedFromWindow() {
    unbind()
    super.onDetachedFromWindow()
  }

  fun release() {
    released = true
    unbind()
    scope.cancel()
    workers.shutdown()
    shutterSound.release()
  }

  private fun unbind() {
    try {
      provider?.unbindAll()
    } catch (_: Exception) {
    }
    imageCapture = null
  }

  private fun fail(message: String) {
    mainHandler.post { onError(mapOf("message" to message)) }
  }

  private fun bind(attempt: Int) {
    if (released) return
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      fail("No activity to bind the camera to")
      return
    }
    scope.launch {
      try {
        // The viewport makes preview, analysis and photo all cover exactly what the view shows. It only exists
        // once the view has been laid out, so wait for that a moment.
        val viewPort = previewView.viewPort
        if (viewPort == null && attempt < VIEWPORT_RETRIES) {
          delay(50)
          bind(attempt + 1)
          return@launch
        }

        val cameraProvider = ProcessCameraProvider.awaitInstance(context)
        provider = cameraProvider

        val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
        val capture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY).build()
        val analysis = ImageAnalysis.Builder()
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .build()
        analysis.setAnalyzer(workers) { image ->
          try {
            analyze(image)
          } finally {
            image.close()
          }
        }

        val group = UseCaseGroup.Builder()
          .addUseCase(preview)
          .addUseCase(capture)
          .addUseCase(analysis)
          .apply { if (viewPort != null) setViewPort(viewPort) }
          .build()

        cameraProvider.unbindAll()
        cameraProvider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, group)
        imageCapture = capture
      } catch (e: CancellationException) {
        throw e
      } catch (e: Exception) {
        fail(e.message ?: "Could not start the camera")
      }
    }
  }

  // Samples the camera's brightness plane into a GRID_W x GRID_H picture, upright and cropped to the view
  private fun analyze(image: ImageProxy) {
    val now = SystemClock.elapsedRealtime()
    if (now - lastFrameAt < FRAME_INTERVAL_MS) return
    lastFrameAt = now

    val plane = image.planes[0]
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride
    val crop = image.cropRect
    val cropW = crop.width().toFloat()
    val cropH = crop.height().toFloat()
    val rotation = image.imageInfo.rotationDegrees
    val out = ByteArray(GRID_W * GRID_H)

    for (gy in 0 until GRID_H) {
      for (gx in 0 until GRID_W) {
        var sum = 0
        for (sy in 0..1) {
          for (sx in 0..1) {
            // Position in the upright picture, then where that lies in the camera's own (rotated) buffer
            val nx = (gx + (sx + 0.5f) / 2f) / GRID_W
            val ny = (gy + (sy + 0.5f) / 2f) / GRID_H
            val bx: Float
            val by: Float
            when (rotation) {
              90 -> { bx = ny; by = 1f - nx }
              180 -> { bx = 1f - nx; by = 1f - ny }
              270 -> { bx = 1f - ny; by = nx }
              else -> { bx = nx; by = ny }
            }
            val px = (crop.left + bx * cropW).toInt().coerceIn(0, image.width - 1)
            val py = (crop.top + by * cropH).toInt().coerceIn(0, image.height - 1)
            sum += buffer.get(py * rowStride + px * pixelStride).toInt() and 0xFF
          }
        }
        out[gy * GRID_W + gx] = (sum / 4).toByte()
      }
    }

    val payload = mapOf("width" to GRID_W, "height" to GRID_H, "data" to Base64.encodeToString(out, Base64.NO_WRAP))
    mainHandler.post { if (!released) onFrame(payload) }
  }

  fun capture(corners: List<Double>?, promise: Promise) {
    val capture = imageCapture
    if (capture == null) {
      promise.reject("E_NOT_READY", "The camera is not ready yet", null)
      return
    }
    pruneOldScans()
    val file = File.createTempFile("scan_", ".jpg", context.cacheDir)
    shutterSound.play(MediaActionSound.SHUTTER_CLICK)
    capture.takePicture(
      ImageCapture.OutputFileOptions.Builder(file).build(),
      ContextCompat.getMainExecutor(context),
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(results: ImageCapture.OutputFileResults) {
          // Decoding and cutting out the page is heavy: keep it off the main thread
          Thread {
            try {
              promise.resolve(cutOutPage(file, corners))
            } catch (e: Throwable) {
              promise.reject("E_CROP", e.message ?: "Could not save the scan", e)
            }
          }.start()
        }

        override fun onError(exception: ImageCaptureException) {
          file.delete()
          promise.reject("E_CAPTURE", exception.message ?: "Could not take the photo", exception)
        }
      }
    )
  }

  // Scans are only needed until they have been read; don't let them pile up in the cache folder
  private fun pruneOldScans() {
    val cutoff = System.currentTimeMillis() - SCAN_KEEP_MS
    context.cacheDir.listFiles()?.forEach { f ->
      if ((f.name.startsWith("scan_") || f.name.startsWith("page_") || f.name.startsWith("full_")) && f.lastModified() < cutoff) f.delete()
    }
  }

  // Upright the photo, then (if a page was found) map the page's four corners onto a flat rectangle.
  // Resolves { uri: the page, fullUri: the whole upright photo or null }: if the cut-out turns out unreadable
  // (e.g. the outline was wrong) the caller can fall back to the whole photo.
  private fun cutOutPage(file: File, corners: List<Double>?): Map<String, String?> {
    var bitmap = BitmapFactory.decodeFile(file.path) ?: throw IllegalStateException("The photo could not be read")
    val degrees = when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees != 0f) {
      val turned = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true)
      bitmap.recycle()
      bitmap = turned
    }

    val usable = corners != null && corners.size == 8 && corners.all { it.isFinite() && it > -0.1 && it < 1.1 }
    var fullUri: String? = null
    val result = if (usable) {
      val whole = File.createTempFile("full_", ".jpg", context.cacheDir)
      whole.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
      fullUri = "file://" + whole.absolutePath
      val w = bitmap.width.toFloat()
      val h = bitmap.height.toFloat()
      val src = FloatArray(8) { i -> (corners!![i] * if (i % 2 == 0) w else h).toFloat() }
      fun side(a: Int, b: Int) = hypot(src[a * 2] - src[b * 2], src[a * 2 + 1] - src[b * 2 + 1])
      var outW = max(side(0, 1), side(3, 2))
      var outH = max(side(0, 3), side(1, 2))
      val shrink = max(1f, max(outW, outH) / MAX_OUTPUT_SIDE)
      outW = max(200f, outW / shrink)
      outH = max(200f, outH / shrink)
      val dst = floatArrayOf(0f, 0f, outW, 0f, outW, outH, 0f, outH)
      val matrix = Matrix()
      matrix.setPolyToPoly(src, 0, dst, 0, 4)
      val page = Bitmap.createBitmap(outW.toInt(), outH.toInt(), Bitmap.Config.ARGB_8888)
      Canvas(page).drawBitmap(bitmap, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
      bitmap.recycle()
      page
    } else {
      bitmap
    }

    val saved = File.createTempFile("page_", ".jpg", context.cacheDir)
    saved.outputStream().use { result.compress(Bitmap.CompressFormat.JPEG, 92, it) }
    result.recycle()
    file.delete()
    return mapOf("uri" to "file://" + saved.absolutePath, "fullUri" to fullUri)
  }
}
