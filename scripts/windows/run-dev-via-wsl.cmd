@echo off
REM Thin wrapper: delegates to start-is01-dev.bat (cmd /c self-relaunch for UNC-safe npm).
call "%~dp0start-is01-dev.bat"
