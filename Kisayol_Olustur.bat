@echo off
chcp 65001 >nul
title AnyClient - Kısayol Oluşturucu
echo.
echo ====================================================
echo   AnyClient Masaüstü Kısayolu Oluşturuluyor...
echo ====================================================
echo.
node "%~dp0scripts\create_shortcut.js"
echo.
echo Tamamlandı! Çıkmak için bir tuşa basın...
pause >nul

