import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { handleEngineMessage, registerEngineSender } from '../services/ocrEngineBridge'

// Same library versions the web app bundles (package.json: tesseract.js
// ^7.0.0, pdfjs-dist ^6.3.289), loaded from jsdelivr — Tesseract.js itself
// already fetches its worker, WASM core and khm/eng traineddata from there
// by default on the web too, so recognition results match the website.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js'
const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs'
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs'

// Ports src/services/ocr.js's detectTextTesseract + extractTextFromPdf into
// the page, with the same Khmer error messages and progress mapping.
const ENGINE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><script src="${TESSERACT_URL}"></script></head>
<body><script>
(function () {
  var send = function (o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); };
  var NO_TEXT = 'មិនអាចរកឃើញអក្សរច្បាស់លាស់ក្នុងរូបភាពនេះទេ។ សូមព្យាយាមថតនៅកន្លែងមានពន្លឺគ្រប់គ្រាន់ ឬកាន់កាមេរ៉ាឱ្យកៀកជាងមុន។ (No readable text was detected by OCR. Try better lighting or hold the camera closer.)';
  var NO_NETWORK = 'មិនអាចទាញយកម៉ាស៊ីនស្កេនបានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។ (Could not load the OCR engine. Check your internet connection.)';
  var currentJob = null;
  var workerPromise = null;

  // If the phone was offline when the app opened, the <script> tag above
  // failed; retry loading it on demand instead of staying broken.
  function ensureTesseract() {
    if (typeof Tesseract !== 'undefined') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '${TESSERACT_URL}';
      s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); reject(new Error(NO_NETWORK)); };
      document.head.appendChild(s);
    });
  }

  function getWorker() {
    if (!workerPromise) {
      workerPromise = ensureTesseract().then(function () { return Tesseract.createWorker('khm+eng', 1, {
        logger: function (m) {
          if (currentJob && m && m.status === 'recognizing text' && typeof m.progress === 'number') {
            currentJob.onProgress(Math.round(m.progress * 100));
          }
        }
      }); }).catch(function (e) {
        workerPromise = null;
        throw (e && e.message && e.message.indexOf('មិនអាច') !== -1) ? e : new Error(NO_NETWORK);
      });
    }
    return workerPromise;
  }

  async function detectTextTesseract(image, onProgress) {
    var worker = await getWorker();
    currentJob = { onProgress: onProgress };
    try {
      var result = await worker.recognize(image);
      var text = result && result.data && result.data.text ? result.data.text.trim() : '';
      if (!text) throw new Error(NO_TEXT);
      return text;
    } finally {
      currentJob = null;
    }
  }

  var pdfjsPromise = null;
  function getPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import('${PDFJS_URL}').then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER_URL}';
        return lib;
      }).catch(function (e) { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function extractTextFromPdf(b64, onProgress) {
    var pdfjsLib = await getPdfjs();
    var pdfDoc = await pdfjsLib.getDocument({ data: base64ToBytes(b64) }).promise;
    var pageLimit = Math.min(pdfDoc.numPages, 10);
    var extractedText = '';
    for (var pageNum = 1; pageNum <= pageLimit; pageNum++) {
      onProgress(Math.round((pageNum / pageLimit) * 40));
      var page = await pdfDoc.getPage(pageNum);
      var content = await page.getTextContent();
      var pageText = content.items.map(function (item) { return item.str; }).join(' ').trim();
      if (pageText) extractedText += pageText + '\\n\\n';
    }
    if (extractedText.trim().length > 20) {
      onProgress(100);
      return extractedText.trim();
    }
    // Scanned PDF with no embedded text: render page 1 and OCR it.
    var first = await pdfDoc.getPage(1);
    var viewport = first.getViewport({ scale: 2.0 });
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await first.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
    return detectTextTesseract(canvas.toDataURL('image/png'), function (pct) {
      onProgress(40 + Math.round(pct * 0.6));
    });
  }

  async function handle(msg) {
    var onProgress = function (v) { send({ type: 'progress', id: msg.id, value: v }); };
    try {
      var text;
      if (msg.mimeType === 'application/pdf') {
        try {
          text = await extractTextFromPdf(msg.base64, onProgress);
        } catch (err) {
          if (err && err.message && err.message.indexOf('មិនអាច') !== -1) throw err;
          throw new Error('មិនអាចស្រង់អត្ថបទពីឯកសារ PDF នេះបានទេ។ សូមពិនិត្យឯកសារ ហើយព្យាយាមម្តងទៀត។');
        }
      } else {
        try {
          text = await detectTextTesseract('data:' + msg.mimeType + ';base64,' + msg.base64, onProgress);
        } catch (err) {
          if (err && err.message && err.message.indexOf('មិនអាច') !== -1) throw err;
          throw new Error('មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ៖ ' + ((err && err.message) || 'សូមព្យាយាមស្កេនម្តងទៀត'));
        }
      }
      send({ type: 'result', id: msg.id, text: text });
    } catch (err) {
      send({ type: 'error', id: msg.id, message: (err && err.message) || 'មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ' });
    }
  }

  function onMessage(e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch (_) { return; }
    if (msg && msg.type === 'recognize') handle(msg);
  }
  window.addEventListener('message', onMessage);
  document.addEventListener('message', onMessage);

  // Warm the worker (downloads core + khm/eng data once) so the first real
  // scan isn't also paying for the model load.
  getWorker().catch(function () {});
  send({ type: 'ready' });
})();
</script></body></html>`

/**
 * Invisible, app-lifetime WebView hosting the OCR engine. Mounted once at
 * the app root so the Tesseract worker (and its downloaded language data)
 * stays warm across scans instead of reloading per capture.
 */
export default function OcrEngineHost() {
  const webRef = useRef(null)

  useEffect(() => {
    registerEngineSender((payload) => webRef.current?.postMessage(payload))
    return () => registerEngineSender(null)
  }, [])

  return (
    <View style={styles.host} pointerEvents="none">
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: ENGINE_HTML, baseUrl: 'https://songkhem.local/' }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={(e) => handleEngineMessage(e.nativeEvent.data)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
})
