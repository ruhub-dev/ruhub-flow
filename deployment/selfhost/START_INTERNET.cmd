@echo off
chcp 65001 >nul
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0launcher.mjs" --internet
if errorlevel 1 (
echo.
echo RUHUB Flow could not complete the operation. Read the message above.
)
pause
