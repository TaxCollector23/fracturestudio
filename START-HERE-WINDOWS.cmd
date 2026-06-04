@echo off
setlocal
cd /d "%~dp0"
echo Starting Fracture Studio on http://localhost:8000
if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 pause & exit /b 1
)
start "" http://localhost:8000
call npm.cmd start
pause
