@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Run the setup first: see docs\SETUP.md
    pause
    exit /b 1
)
.venv\Scripts\python.exe -m tools.start %*
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" pause
exit /b %CODE%
