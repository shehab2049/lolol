@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Ishara is not installed yet. Running setup...
  call setup_windows.bat
  if errorlevel 1 exit /b 1
)

echo Starting Ishara at http://127.0.0.1:5000
start "" "http://127.0.0.1:5000"
call .venv\Scripts\python.exe web_app.py
pause
