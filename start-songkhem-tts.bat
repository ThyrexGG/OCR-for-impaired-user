@echo off
chcp 65001 >nul
echo =====================================================================
echo   songKHEM // Khmer Neural TTS Engine + Accessibility Web App
echo =====================================================================
start "Khmer Neural TTS Engine (Port 5055)" cmd /k "cd /d "%~dp0khmer-tts-engine" && py server.py"
cd /d "%~dp0"
npm run dev
