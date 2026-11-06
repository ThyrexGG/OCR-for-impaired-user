#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Khmer Neural TTS & Linguistic Studio Microservice (Port 5055)
=============================================================
Provides:
  - POST /api/tts          : Synthesizes high-definition Khmer speech (MP3 binary or JSON with Karaoke timestamps)
  - POST /api/analyze      : Returns Unicode canonicalization, Khmer normalization, word segmentation, and IPA phonemes
  - POST /api/lexicon      : Adds/updates custom Pali/Sanskrit/Medical pronunciation overrides in khmer_lexicon.json
  - GET  /api/health       : Service status, lexicon count, and VITS training pipeline readiness
  - GET  /                 : Interactive Khmer TTS & Phoneme Tuning Studio UI
"""

from __future__ import annotations
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from tts_synthesizer import KhmerNeuralTTS
from vits_khmer_trainer import TrainingConfig, verify_training_pipeline

PORT = 5055
ENGINE = KhmerNeuralTTS()
BASE_DIR = Path(__file__).parent


class KhmerTTSHandler(BaseHTTPRequestHandler):
    def _set_cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def _send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            report_path = BASE_DIR / "checkpoints" / "training_report.json"
            model_report = {}
            if report_path.exists():
                try:
                    model_report = json.loads(report_path.read_text(encoding="utf-8"))
                except Exception:
                    pass
            self._send_json(
                {
                    "status": "ONLINE",
                    "engine": "KhmerNeuralTTS v2.0 (VITS + Neural Vocoder + A/O Register G2P)",
                    "lexicon_entries": len(ENGINE.linguistics.lexicon),
                    "voices": [
                        "km-KH-PisethNeural",
                        "km-KH-SreymomNeural",
                        "km-KH-SokhaMedical",
                        "km-KH-VitsOffline",
                    ],
                    "trained_model": model_report,
                }
            )
            return

        if parsed.path.startswith("/audio/"):
            fname = Path(parsed.path).name
            fpath = ENGINE.cache_dir / fname
            if fpath.exists():
                data = fpath.read_bytes()
                mime = "audio/wav" if fpath.suffix.lower() == ".wav" else "audio/mpeg"
                self.send_response(200)
                self._set_cors()
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        self._send_json({"error": "Not found"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        data = self._read_json()

        if parsed.path == "/api/analyze":
            text = str(data.get("text", "")).strip()
            res = ENGINE.linguistics.analyze(text)
            self._send_json(res.__dict__)
            return

        if parsed.path == "/api/lexicon":
            word = str(data.get("word", "")).strip()
            respell = str(data.get("respell", "")).strip()
            ipa = str(data.get("ipa", "")).strip()
            if not word or not respell:
                self._send_json({"error": "word and respell required"}, status=400)
                return
            ENGINE.linguistics.add_lexicon_entry(word, respell, ipa or respell)
            self._send_json({"status": "UPDATED", "lexicon_size": len(ENGINE.linguistics.lexicon)})
            return

        if parsed.path == "/api/tts":
            text = str(data.get("text", "")).strip()
            voice = str(data.get("voice", "km-KH-PisethNeural"))
            rate = float(data.get("rate", 1.0))
            pitch_hz = int(data.get("pitch_hz", 0))
            assistive_pacing = bool(data.get("assistive_pacing", False))
            return_binary = bool(data.get("binary", False))

            if not text:
                self._send_json({"error": "Missing text"}, status=400)
                return

            synth = ENGINE.synthesize(
                text=text,
                voice=voice,
                rate=rate,
                pitch_hz=pitch_hz,
                assistive_pacing=assistive_pacing,
            )
            if return_binary:
                audio_path_obj = Path(synth.audio_path)
                audio_bytes = audio_path_obj.read_bytes()
                mime = "audio/wav" if audio_path_obj.suffix.lower() == ".wav" else "audio/mpeg"
                self.send_response(200)
                self._set_cors()
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(audio_bytes)))
                self.end_headers()
                self.wfile.write(audio_bytes)
                return

            audio_name = Path(synth.audio_path).name
            self._send_json(
                {
                    "audio_url": f"http://localhost:{PORT}/audio/{audio_name}",
                    "voice": synth.voice,
                    "duration_sec": synth.duration_sec,
                    "synthesis_ms": synth.synthesis_ms,
                    "analysis": synth.analysis,
                    "word_timestamps": synth.word_timestamps,
                }
            )
            return

        self._send_json({"error": "Unknown endpoint"}, status=404)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), KhmerTTSHandler)
    print(f"[KHMER NEURAL TTS] Server listening on http://localhost:{PORT}")
    server.serve_forever()
