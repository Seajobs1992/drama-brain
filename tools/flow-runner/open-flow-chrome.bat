@echo off
rem Opens the "Flow Chrome" on Windows: Google Chrome with its own profile (kept apart from your everyday Chrome)
rem and remote debugging on port 9333, the same as the Flow Chrome on the first Mac. Double-click to open it.
rem Sign in to Flow and load the extensions in this window the first time; it remembers them after that.
set "PROFILE=%USERPROFILE%\flow-chrome-profile"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (echo Google Chrome was not found. Install it from google.com/chrome, then try again. & pause & exit /b 1)
start "" "%CHROME%" --user-data-dir="%PROFILE%" --remote-debugging-port=9333 "https://flow.google.com/"
