@echo off
waitress-serve --listen=0.0.0.0:80 AudioPleer.wsgi:application
pause
