@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Python was not found.
  echo Install Python 3.10 or 3.11 from https://www.python.org/downloads/windows/
  echo Enable "Add Python to PATH" during installation.
  pause
  exit /b 1
)

echo Creating Python environment...
py -3.10 -m venv .venv 2>nul
if errorlevel 1 py -3.11 -m venv .venv
if errorlevel 1 (
  echo Python 3.10 or 3.11 is required.
  pause
  exit /b 1
)

echo Installing dependencies...
call .venv\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 goto :failed
call .venv\Scripts\python.exe -m pip install -r requirements-windows.txt
if errorlevel 1 goto :failed

echo.
echo Setup completed. Double-click start_windows.bat to run Ishara.
pause
exit /b 0

:failed
echo.
echo Setup failed. Review the error above.
pause
exit /b 1
