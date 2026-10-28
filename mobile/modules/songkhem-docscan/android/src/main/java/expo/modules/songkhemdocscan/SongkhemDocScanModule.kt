package expo.modules.songkhemdocscan

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * A camera view for scanning pages. Besides the live preview it streams a tiny brightness picture of what the
 * camera sees (the JavaScript side finds the page in it and draws the outline), and its capture() takes the
 * photo and cuts out just the page, straightened.
 */
class SongkhemDocScanModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SongkhemDocScan")

    View(DocCameraView::class) {
      Events("onFrame", "onError")

      // corners: [x0, y0, x1, y1, x2, y2, x3, y3] as 0..1 fractions of the view, top-left clockwise; null = whole view.
      // Resolves { uri, fullUri }: the saved page's file:// uri, and the whole upright photo (null when not cropped).
      AsyncFunction("capture") { view: DocCameraView, corners: List<Double>?, promise: Promise ->
        view.capture(corners, promise)
      }

      OnViewDestroys { view: DocCameraView -> view.release() }
    }
  }
}
