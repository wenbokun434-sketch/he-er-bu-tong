@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0heyi-os"
if errorlevel 1 goto directory_error
set "DEMO_NODE="
if exist "%ProgramFiles%\nodejs\node.exe" set "DEMO_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined DEMO_NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "DEMO_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined DEMO_NODE for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined DEMO_NODE set "DEMO_NODE=%%N"
if not defined DEMO_NODE goto node_error
"%DEMO_NODE%" "%~dp0heyi-os\scripts\launch-demo.mjs" %*
set "DEMO_EXIT=%errorlevel%"
if not "%DEMO_EXIT%"=="0" echo Startup failed. Log: "%~dp0heyi-os\.sites-runtime\rehearsal"
if /i not "%~1"=="--no-pause" if /i not "%~2"=="--no-pause" pause
exit /b %DEMO_EXIT%
:node_error
echo Node.js was not found. Please install Node.js 24 and try again.
if /i not "%~1"=="--no-pause" pause
exit /b 1
:directory_error
echo Cannot open the heyi-os folder beside this launcher.
if /i not "%~1"=="--no-pause" pause
exit /b 1
