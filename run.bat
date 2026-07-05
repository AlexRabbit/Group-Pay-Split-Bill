@echo off
title Group Pay Split Bill
cd /d "%~dp0"

echo.
echo  ========================================
echo   GROUP PAY SPLIT BILL - Local Server
echo  ========================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARN] Node.js not found. Install from https://nodejs.org/
    echo        Opening index.html directly instead...
    start "" "%~dp0index.html"
    goto :done
)

echo [1/3] Running unit tests...
node tests\run-tests.js
if %ERRORLEVEL% neq 0 (
    echo [FAIL] Tests failed. Fix before running.
    goto :done
)
echo [OK] All tests passed.

echo.
echo [2/3] Starting local server on http://localhost:8080
echo        Press Ctrl+C to stop.
echo.

where npx >nul 2>&1
if %ERRORLEVEL% equ 0 (
    npx --yes serve -l 8080 .
) else (
    echo [WARN] npx not available. Opening file directly...
    start "" "%~dp0index.html"
)

:done
echo.
pause
