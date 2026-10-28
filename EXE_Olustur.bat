@echo off
chcp 65001 >nul
title AnyClient - EXE Olusturucu
echo.
echo ====================================================
echo   AnyClient Bagimsiz .EXE Olusturuluyor...
echo ====================================================
echo.
node "%~dp0scripts\build_exe.js"
echo.
echo Islem tamamlandi. Cikmak icin bir tusa basin...
pause >nul

