@echo off
chcp 850 >nul 2>&1
setlocal enabledelayedexpansion

:: ============================================================================
::  VIGIA DevKit - Centro de Control para Desarrollo y Pruebas
::  Proyecto: Vigia - Control de Acceso Perimetral
::  Autor: ChrizDev
:: ============================================================================

:: -- Configuracion de Rutas ------------------------------------------------
set "ROOT=E:\aplicativos ChrizDev\Vigia"
set "ADMIN=%ROOT%\admin-panel"
set "FLUTTER=%ROOT%\vigilante_app"
set "SUPABASE=%ROOT%\supabase"
set "LOGDIR=%ROOT%\logs"

:: Generar nombre de log con timestamp
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value 2^>nul ^| findstr LocalDateTime') do set "DTS=%%a"
set "LOGFILE=%LOGDIR%\vigia_devkit_%DTS:~0,8%_%DTS:~8,4%.log"

:: Puerto del servidor Astro
set "ASTRO_PORT=4321"
set "ASTRO_URL=http://localhost:%ASTRO_PORT%"

:: Crear carpeta de logs si no existe
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

:: -- Deteccion Dinamica de Chrome ------------------------------------------
set "CHROME="
for %%P in (
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
    "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) do (
    if exist %%P (
        set "CHROME=%%~P"
    )
)
if "!CHROME!"=="" (
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul') do set "CHROME=%%b"
)
if "!CHROME!"=="" (
    where chrome.exe >nul 2>&1 && set "CHROME=chrome.exe"
)

:: -- Funciones de logging --------------------------------------------------
goto :SKIP_FUNCTIONS

:LOG
    for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value 2^>nul ^| findstr LocalDateTime') do set "_DT=%%a"
    set "_TS=!_DT:~0,4!-!_DT:~4,2!-!_DT:~6,2! !_DT:~8,2!:!_DT:~10,2!:!_DT:~12,2!"
    echo [!_TS!] %~1 >> "%LOGFILE%"
    goto :eof

:WAIT_KEY
    echo.
    echo   Presiona cualquier tecla para volver al menu...
    pause >nul
    goto :eof

:SKIP_FUNCTIONS

:: ===========================================================================
::  MENU PRINCIPAL
:: ===========================================================================
:MENU
cls
call :LOG "Menu principal abierto"
echo.
echo  +=============================================================+
echo  ^|                                                             ^|
echo  ^|         VIGIA DevKit - Centro de Control v1.0               ^|
echo  ^|         Control de Acceso Perimetral                        ^|
echo  ^|                                                             ^|
echo  +=============================================================+
echo  ^|                                                             ^|
echo  ^|  SERVIDORES DE DESARROLLO                                   ^|
echo  ^|  -----------------------------------------------------------^|
echo  ^|  [1]  Iniciar Servidor Web (Admin Panel - Astro)            ^|
echo  ^|  [2]  Iniciar App Movil (Flutter)                           ^|
echo  ^|  [3]  Iniciar TODO (Web + Movil + Navegadores)              ^|
echo  ^|  [E]  Iniciar App de Escritorio Electron (Prueba Offline)   ^|
echo  ^|                                                             ^|
echo  ^|  COMPILACION Y BUILDS                                       ^|
echo  ^|  -----------------------------------------------------------^|
echo  ^|  [4]  Build Produccion Web (Astro)                          ^|
echo  ^|  [5]  Build Electron (.exe Offline)                         ^|
echo  ^|  [6]  Build APK Android (Flutter)                           ^|
echo  ^|                                                             ^|
echo  ^|  HERRAMIENTAS                                               ^|
echo  ^|  -----------------------------------------------------------^|
echo  ^|  [7]  Diagnostico de Archivos e Integridad                  ^|
echo  ^|  [8]  Explorador de Carpetas del Proyecto                   ^|
echo  ^|  [9]  Ver Logs del DevKit                                   ^|
echo  ^|                                                             ^|
echo  ^|  [0]  Salir                                                 ^|
echo  ^|                                                             ^|
echo  +=============================================================+
echo.
set /p "CHOICE=   Selecciona una opcion [0-9, E]: "

if /i "%CHOICE%"=="E" goto :RUN_ELECTRON
if "%CHOICE%"=="1" goto :SERVER_WEB
if "%CHOICE%"=="2" goto :SERVER_FLUTTER
if "%CHOICE%"=="3" goto :START_ALL
if "%CHOICE%"=="4" goto :BUILD_ASTRO
if "%CHOICE%"=="5" goto :BUILD_ELECTRON
if "%CHOICE%"=="6" goto :BUILD_APK
if "%CHOICE%"=="7" goto :DIAGNOSTICO
if "%CHOICE%"=="8" goto :EXPLORADOR
if "%CHOICE%"=="9" goto :VER_LOGS
if "%CHOICE%"=="0" goto :SALIR

echo.
echo   [!] Opcion invalida. Intenta de nuevo.
timeout /t 2 >nul
goto :MENU

:: ===========================================================================
::  [1] SERVIDOR WEB (ADMIN PANEL)
:: ===========================================================================
:SERVER_WEB
cls
echo.
echo  =============================================================
echo   SERVIDOR WEB - Admin Panel (Astro)
echo  =============================================================
call :LOG "Iniciando servidor web Astro"

:: Verificar node_modules
if not exist "%ADMIN%\node_modules" (
    echo.
    echo   [!] No se encontro node_modules. Instalando dependencias...
    call :LOG "Instalando dependencias con pnpm install"
    cd /d "%ADMIN%"
    call pnpm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo   [X] Error al instalar dependencias. Revisa el log.
        call :LOG "ERROR: pnpm install fallo"
        call :WAIT_KEY
        goto :MENU
    )
    echo   [OK] Dependencias instaladas correctamente.
)

echo.
echo   [*] Iniciando servidor de desarrollo en %ASTRO_URL%...
echo   (El servidor se abrira en una ventana separada)
echo.
call :LOG "Lanzando astro dev en ventana separada"

:: Abrir el servidor en una nueva ventana CMD
start "VIGIA - Astro Dev Server" cmd /k "cd /d "%ADMIN%" && pnpm dev"

:: Esperar a que el servidor arranque
echo   [..] Esperando que el servidor arranque (8 segundos)...
timeout /t 8 /nobreak >nul

:: Preguntar si abrir navegadores
echo.
set /p "OPEN_BROWSER=   Abrir navegadores para pruebas? (S/N): "
if /i "!OPEN_BROWSER!"=="S" call :OPEN_BROWSERS

call :LOG "Servidor web iniciado correctamente"
call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  [2] SERVIDOR FLUTTER (APP MOVIL)
:: ===========================================================================
:SERVER_FLUTTER
cls
echo.
echo  =============================================================
echo   APP MOVIL - Flutter
echo  =============================================================
call :LOG "Iniciando Flutter app"

where flutter >nul 2>&1
if errorlevel 1 (
    echo   [X] Flutter no encontrado en el PATH.
    echo       Instala Flutter desde: https://flutter.dev/docs/get-started/install
    call :LOG "ERROR: Flutter no encontrado"
    call :WAIT_KEY
    goto :MENU
)

echo.
echo   Dispositivos disponibles:
echo   -----------------------------------------------------------
cd /d "%FLUTTER%"
flutter devices 2>nul
echo   -----------------------------------------------------------
echo.
echo   En que dispositivo quieres ejecutar?
echo.
echo   [1]  Android Emulator (emulator-5554)
echo   [2]  Windows Desktop
echo   [3]  Chrome (Web)
echo   [4]  Edge (Web)
echo   [5]  Volver al menu
echo.
set /p "FLUTTER_DEVICE=   Selecciona dispositivo [1-5]: "

set "DEVICE_ID="
if "%FLUTTER_DEVICE%"=="1" set "DEVICE_ID=emulator-5554"
if "%FLUTTER_DEVICE%"=="2" set "DEVICE_ID=windows"
if "%FLUTTER_DEVICE%"=="3" set "DEVICE_ID=chrome"
if "%FLUTTER_DEVICE%"=="4" set "DEVICE_ID=edge"
if "%FLUTTER_DEVICE%"=="5" goto :MENU

if "!DEVICE_ID!"=="" (
    echo   [!] Opcion invalida.
    timeout /t 2 >nul
    goto :SERVER_FLUTTER
)

echo.
echo   [*] Ejecutando Flutter en dispositivo: !DEVICE_ID!
echo       (Se abrira en una ventana separada)
call :LOG "Lanzando flutter run -d !DEVICE_ID!"

start "VIGIA - Flutter App (!DEVICE_ID!)" cmd /k "cd /d "%FLUTTER%" && flutter run -d !DEVICE_ID!"

echo   [OK] Flutter lanzado en ventana separada.
call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  [3] INICIAR TODO (WEB + MOVIL + NAVEGADORES)
:: ===========================================================================
:START_ALL
cls
echo.
echo  =============================================================
echo   INICIO COMPLETO - Web + Movil + Navegadores
echo  =============================================================
call :LOG "Inicio completo: web + movil + navegadores"

:: Verificar node_modules
if not exist "%ADMIN%\node_modules" (
    echo.
    echo   [!] Instalando dependencias del Admin Panel...
    cd /d "%ADMIN%"
    call pnpm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo   [X] Error instalando dependencias.
        call :LOG "ERROR: pnpm install fallo en inicio completo"
        call :WAIT_KEY
        goto :MENU
    )
)

echo.
echo   [1/3] Iniciando servidor Astro...
start "VIGIA - Astro Dev Server" cmd /k "cd /d "%ADMIN%" && pnpm dev"
call :LOG "Servidor Astro lanzado"

echo   [2/3] Esperando servidor (10 segundos)...
timeout /t 10 /nobreak >nul

echo   [3/3] Iniciando Flutter en Android Emulator...
start "VIGIA - Flutter Emulator" cmd /k "cd /d "%FLUTTER%" && flutter run -d emulator-5554"
call :LOG "Flutter lanzado en emulator-5554"

:: Abrir navegadores
timeout /t 2 /nobreak >nul
call :OPEN_BROWSERS

echo.
echo  =============================================================
echo   [OK] TODOS LOS SERVICIOS INICIADOS
echo  =============================================================
echo.
echo   Panel Web:     %ASTRO_URL%
echo   App Movil:     Flutter en emulador Android
echo   SuperAdmin:    Pestana normal de Chrome
echo   Admin:         Ventana incognita de Chrome
echo.
call :LOG "Inicio completo exitoso"
call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  HELPER: ABRIR NAVEGADORES
:: ===========================================================================
:OPEN_BROWSERS
call :LOG "Abriendo navegadores"

if defined CHROME (
    echo   [*] Abriendo Chrome (pestana normal para SuperAdmin)...
    start "" "!CHROME!" "%ASTRO_URL%/login"
    timeout /t 2 /nobreak >nul

    echo   [*] Abriendo Chrome (incognito para Admin Empresa)...
    start "" "!CHROME!" --incognito "%ASTRO_URL%/login"
    call :LOG "Chrome abierto: normal + incognito"
) else (
    echo   [!] Chrome no detectado. Intentando con navegador predeterminado...
    start "" "%ASTRO_URL%/login"
    call :LOG "WARN: Chrome no detectado, usando navegador predeterminado"
    echo.
    echo   TIP: Para usar modo incognito, abre manualmente una ventana
    echo        privada en tu navegador e ingresa a %ASTRO_URL%/login
)
goto :eof

:: ===========================================================================
::  [4] BUILD PRODUCCION WEB (ASTRO)
:: ===========================================================================
:BUILD_ASTRO
cls
echo.
echo  =============================================================
echo   BUILD DE PRODUCCION - Astro (Admin Panel)
echo  =============================================================
call :LOG "Iniciando build de produccion Astro"

if not exist "%ADMIN%\node_modules" (
    echo   [!] Instalando dependencias primero...
    cd /d "%ADMIN%"
    call pnpm install >> "%LOGFILE%" 2>&1
)

echo.
echo   [*] Compilando proyecto...
echo       (Esto puede tomar unos segundos)
echo.

cd /d "%ADMIN%"
call pnpm build 2>&1
if errorlevel 1 (
    echo.
    echo   [X] BUILD FALLO - Revisa los errores arriba
    call :LOG "ERROR: Build de produccion Astro fallo"
) else (
    echo.
    echo   [OK] BUILD EXITOSO
    echo   Archivos en: %ADMIN%\dist\
    call :LOG "Build de produccion Astro exitoso"
)

call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  [5] BUILD ELECTRON (.exe OFFLINE)
:: ===========================================================================
:BUILD_ELECTRON
cls
echo.
echo  =============================================================
echo   BUILD ELECTRON - Version Offline (.exe)
echo  =============================================================
call :LOG "Iniciando build Electron"

echo.
echo   [*] Verificando dependencias de Electron...

cd /d "%ADMIN%"

:: Verificar si electron esta como dependencia local
if not exist "%ADMIN%\node_modules\electron" (
    echo   [!] Electron no encontrado como dependencia local.
    echo.
    set /p "INST_ELECTRON=   Deseas instalar electron y electron-builder? (S/N): "
    if /i "!INST_ELECTRON!"=="S" (
        echo   [*] Instalando electron y electron-builder...
        call pnpm add -D electron electron-builder >> "%LOGFILE%" 2>&1
        if errorlevel 1 (
            echo   [X] Error al instalar Electron.
            call :LOG "ERROR: Instalacion de Electron fallo"
            call :WAIT_KEY
            goto :MENU
        )
        echo   [OK] Electron instalado correctamente.
    ) else (
        echo   Volviendo al menu...
        goto :MENU
    )
)

echo.
echo   [1/2] Compilando Astro (build de produccion)...
call pnpm build >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo   [X] Build de Astro fallo. No se puede continuar.
    call :LOG "ERROR: Astro build fallo previo a Electron"
    call :WAIT_KEY
    goto :MENU
)
echo   [OK] Build de Astro completado.

echo   [2/2] Empaquetando con Electron Builder...
call pnpm electron:make >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo.
    echo   [X] Build de Electron fallo. Revisa el log para detalles.
    echo   Log: %LOGFILE%
    call :LOG "ERROR: electron-builder fallo"
) else (
    echo.
    echo   [OK] BUILD ELECTRON EXITOSO
    echo   Ejecutable en: %ADMIN%\dist\
    call :LOG "Build Electron exitoso"
)

call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  [6] BUILD APK ANDROID (FLUTTER)
:: ===========================================================================
:BUILD_APK
cls
echo.
echo  =============================================================
echo   BUILD APK - Android (Flutter)
echo  =============================================================
call :LOG "Iniciando build APK Android"

where flutter >nul 2>&1
if errorlevel 1 (
    echo   [X] Flutter no encontrado.
    call :WAIT_KEY
    goto :MENU
)

echo.
echo   Que tipo de APK quieres generar?
echo.
echo   [1]  Debug APK (rapido, para pruebas)
echo   [2]  Release APK (optimizado, para distribucion)
echo   [3]  App Bundle (para Google Play Store)
echo   [4]  Volver
echo.
set /p "APK_TYPE=   Selecciona [1-4]: "

set "BUILD_CMD="
set "BUILD_DESC="
if "%APK_TYPE%"=="1" (
    set "BUILD_CMD=flutter build apk --debug"
    set "BUILD_DESC=Debug APK"
)
if "%APK_TYPE%"=="2" (
    set "BUILD_CMD=flutter build apk --release"
    set "BUILD_DESC=Release APK"
)
if "%APK_TYPE%"=="3" (
    set "BUILD_CMD=flutter build appbundle --release"
    set "BUILD_DESC=App Bundle"
)
if "%APK_TYPE%"=="4" goto :MENU

if "!BUILD_CMD!"=="" (
    echo   [!] Opcion invalida.
    timeout /t 2 >nul
    goto :BUILD_APK
)

echo.
echo   [*] Generando !BUILD_DESC!...
echo       (Esto puede tomar varios minutos)
echo.
call :LOG "Generando !BUILD_DESC!"

cd /d "%FLUTTER%"
call !BUILD_CMD! 2>&1
if errorlevel 1 (
    echo.
    echo   [X] Build fallo. Revisa los errores arriba.
    call :LOG "ERROR: Flutter build !BUILD_DESC! fallo"
) else (
    echo.
    echo   [OK] !BUILD_DESC! generado exitosamente.
    if "%APK_TYPE%"=="1" echo   APK en: %FLUTTER%\build\app\outputs\flutter-apk\app-debug.apk
    if "%APK_TYPE%"=="2" echo   APK en: %FLUTTER%\build\app\outputs\flutter-apk\app-release.apk
    if "%APK_TYPE%"=="3" echo   Bundle: %FLUTTER%\build\app\outputs\bundle\release\app-release.aab
    call :LOG "Flutter build !BUILD_DESC! exitoso"
)

call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  [7] DIAGNOSTICO DE ARCHIVOS E INTEGRIDAD
:: ===========================================================================
:DIAGNOSTICO
cls
echo.
echo  =============================================================
echo   DIAGNOSTICO DE ARCHIVOS E INTEGRIDAD
echo  =============================================================
call :LOG "Ejecutando diagnostico de integridad"

echo.
echo  +-----------------------------------------------------------+
echo  ^|  HERRAMIENTAS DEL SISTEMA                                 ^|
echo  +-----------------------------------------------------------+
echo.

:: Node.js
echo   Node.js:
where node >nul 2>&1
if errorlevel 1 (
    echo     [X] NO INSTALADO
    call :LOG "DIAG: Node.js no encontrado"
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo     [OK] %%v
)

:: PNPM
echo   PNPM:
where pnpm >nul 2>&1
if errorlevel 1 (
    echo     [X] NO INSTALADO
) else (
    for /f "tokens=*" %%v in ('pnpm --version 2^>nul') do echo     [OK] v%%v
)

:: Flutter
echo   Flutter:
where flutter >nul 2>&1
if errorlevel 1 (
    echo     [X] NO INSTALADO
) else (
    for /f "tokens=*" %%v in ('flutter --version 2^>nul ^| findstr "Flutter"') do echo     [OK] %%v
)

:: Chrome
echo   Chrome:
if defined CHROME (
    echo     [OK] Detectado en: !CHROME!
) else (
    echo     [!] No detectado (se usara navegador predeterminado)
)

:: Git
echo   Git:
where git >nul 2>&1
if errorlevel 1 (
    echo     [!] No instalado (opcional)
) else (
    for /f "tokens=*" %%v in ('git --version 2^>nul') do echo     [OK] %%v
)

echo.
echo  +-----------------------------------------------------------+
echo  ^|  ARCHIVOS CRITICOS DEL PROYECTO                           ^|
echo  +-----------------------------------------------------------+
echo.

:: Admin Panel
echo   Admin Panel (Web):
for %%F in (
    "package.json"
    "astro.config.mjs"
    "tsconfig.json"
    ".env"
    "electron-main.cjs"
    "pnpm-lock.yaml"
) do (
    if exist "%ADMIN%\%%~F" (
        echo     [OK] %%~F
    ) else (
        echo     [X]  %%~F  -- FALTANTE
    )
)

echo.
echo   Admin Panel - Componentes:
for %%D in (
    auth
    dashboard
    chat
    usuarios
    clientes
    accesos
    autorizaciones
    novedades
    soporte
    configuracion
    layout
    ui
) do (
    if exist "%ADMIN%\src\components\%%D" (
        echo     [OK] src\components\%%D
    ) else (
        echo     [X]  src\components\%%D  -- FALTANTE
    )
)

echo.
echo   Admin Panel - Paginas:
for %%F in (
    "src\pages\index.astro"
    "src\pages\login.astro"
    "src\pages\landing.astro"
    "src\pages\configuracion.astro"
) do (
    if exist "%ADMIN%\%%~F" (
        echo     [OK] %%~F
    ) else (
        echo     [X]  %%~F  -- FALTANTE
    )
)

echo.
echo   Flutter App (Movil):
for %%F in (
    "pubspec.yaml"
    "pubspec.lock"
    "lib\main.dart"
    "lib\app.dart"
    "lib\presentation\screens\login_screen.dart"
    "lib\presentation\screens\registro_rapido_screen.dart"
) do (
    if exist "%FLUTTER%\%%~F" (
        echo     [OK] %%~F
    ) else (
        echo     [X]  %%~F  -- FALTANTE
    )
)

echo.
echo   Supabase (Base de Datos):
for %%F in (
    "seed.sql"
    "update_db_public.sql"
) do (
    if exist "%SUPABASE%\%%~F" (
        echo     [OK] %%~F
    ) else (
        echo     [X]  %%~F  -- FALTANTE
    )
)
if exist "%SUPABASE%\migrations" (
    echo     [OK] migrations\
) else (
    echo     [X]  migrations\  -- FALTANTE
)

echo.
echo  +-----------------------------------------------------------+
echo  ^|  DEPENDENCIAS Y BUILDS                                    ^|
echo  +-----------------------------------------------------------+
echo.

echo   Admin Panel - node_modules:
if exist "%ADMIN%\node_modules" (
    echo     [OK] Instaladas
) else (
    echo     [X]  NO INSTALADAS - Ejecuta opcion [1] o [4]
)

echo   Admin Panel - dist (build):
if exist "%ADMIN%\dist" (
    echo     [OK] Existe (build previo disponible)
) else (
    echo     [!]  No existe (ejecuta opcion [4] para generar)
)

echo   Flutter - .dart_tool:
if exist "%FLUTTER%\.dart_tool" (
    echo     [OK] Configurado
) else (
    echo     [!]  No configurado - Ejecuta 'flutter pub get'
)

echo.
echo  +-----------------------------------------------------------+
echo  ^|  VARIABLES DE ENTORNO (.env)                               ^|
echo  +-----------------------------------------------------------+
echo.
if exist "%ADMIN%\.env" (
    echo   .env encontrado. Verificando claves:
    findstr /c:"PUBLIC_SUPABASE_URL" "%ADMIN%\.env" >nul 2>&1
    if errorlevel 1 (echo     [X] PUBLIC_SUPABASE_URL no definida) else (echo     [OK] PUBLIC_SUPABASE_URL)
    findstr /c:"PUBLIC_SUPABASE_ANON_KEY" "%ADMIN%\.env" >nul 2>&1
    if errorlevel 1 (echo     [X] PUBLIC_SUPABASE_ANON_KEY no definida) else (echo     [OK] PUBLIC_SUPABASE_ANON_KEY)
    findstr /c:"SUPABASE_SERVICE_ROLE_KEY" "%ADMIN%\.env" >nul 2>&1
    if errorlevel 1 (echo     [X] SUPABASE_SERVICE_ROLE_KEY no definida) else (echo     [OK] SUPABASE_SERVICE_ROLE_KEY)
) else (
    echo   [X] Archivo .env NO encontrado.
    echo       Copia .env.example a .env y configura las variables.
)

echo.
echo  +-----------------------------------------------------------+
echo  ^|  ESTADISTICAS DEL PROYECTO                                ^|
echo  +-----------------------------------------------------------+
echo.

set "TSX_COUNT=0"
set "DART_COUNT=0"
set "ASTRO_COUNT=0"
set "CSS_COUNT=0"

for /f %%n in ('dir /s /b "%ADMIN%\src\*.tsx" 2^>nul ^| find /c /v ""') do set "TSX_COUNT=%%n"
for /f %%n in ('dir /s /b "%FLUTTER%\lib\*.dart" 2^>nul ^| find /c /v ""') do set "DART_COUNT=%%n"
for /f %%n in ('dir /s /b "%ADMIN%\src\*.astro" 2^>nul ^| find /c /v ""') do set "ASTRO_COUNT=%%n"
for /f %%n in ('dir /s /b "%ADMIN%\src\*.css" 2^>nul ^| find /c /v ""') do set "CSS_COUNT=%%n"

echo   Archivos .tsx  (React):    !TSX_COUNT!
echo   Archivos .dart (Flutter):  !DART_COUNT!
echo   Archivos .astro (Paginas): !ASTRO_COUNT!
echo   Archivos .css  (Estilos):  !CSS_COUNT!

call :LOG "Diagnostico completado: TSX=!TSX_COUNT! DART=!DART_COUNT! ASTRO=!ASTRO_COUNT!"

call :WAIT_KEY
goto :MENU

:: ===========================================================================
::  [8] EXPLORADOR DE CARPETAS
:: ===========================================================================
:EXPLORADOR
cls
echo.
echo  =============================================================
echo   EXPLORADOR DE CARPETAS DEL PROYECTO
echo  =============================================================
echo.
echo   CARPETAS PRINCIPALES
echo   -----------------------------------------------------------
echo   [1]  Raiz del Proyecto (Vigia)
echo   [2]  Admin Panel (admin-panel)
echo   [3]  App Movil (vigilante_app)
echo   [4]  Base de Datos (supabase)
echo.
echo   CARPETAS DE USO FRECUENTE
echo   -----------------------------------------------------------
echo   [5]  Componentes React (src\components)
echo   [6]  Paginas Astro (src\pages)
echo   [7]  Estilos CSS (src\styles)
echo   [8]  Pantallas Flutter (lib\presentation\screens)
echo   [9]  Providers Flutter (lib\presentation\providers)
echo   [A]  Dist / Build Web (admin-panel\dist)
echo   [B]  Logs del DevKit
echo   [C]  Config (package.json, .env, astro.config, etc.)
echo.
echo   [0]  Volver al menu
echo.
set /p "FOLDER=   Selecciona carpeta [0-9,A-C]: "

set "TARGET="
if "%FOLDER%"=="1" set "TARGET=%ROOT%"
if "%FOLDER%"=="2" set "TARGET=%ADMIN%"
if "%FOLDER%"=="3" set "TARGET=%FLUTTER%"
if "%FOLDER%"=="4" set "TARGET=%SUPABASE%"
if "%FOLDER%"=="5" set "TARGET=%ADMIN%\src\components"
if "%FOLDER%"=="6" set "TARGET=%ADMIN%\src\pages"
if "%FOLDER%"=="7" set "TARGET=%ADMIN%\src\styles"
if "%FOLDER%"=="8" set "TARGET=%FLUTTER%\lib\presentation\screens"
if "%FOLDER%"=="9" set "TARGET=%FLUTTER%\lib\presentation\providers"
if /i "%FOLDER%"=="A" set "TARGET=%ADMIN%\dist"
if /i "%FOLDER%"=="B" set "TARGET=%LOGDIR%"
if /i "%FOLDER%"=="C" set "TARGET=%ADMIN%"
if "%FOLDER%"=="0" goto :MENU

if "!TARGET!"=="" (
    echo   [!] Opcion invalida.
    timeout /t 2 >nul
    goto :EXPLORADOR
)

if not exist "!TARGET!" (
    echo   [X] La carpeta no existe: !TARGET!
    echo       Es posible que necesites compilar el proyecto primero.
    call :LOG "WARN: Carpeta no existe: !TARGET!"
    call :WAIT_KEY
    goto :EXPLORADOR
)

call :LOG "Abriendo explorador: !TARGET!"
start "" explorer "!TARGET!"
echo   [OK] Explorador abierto en: !TARGET!
timeout /t 2 >nul
goto :EXPLORADOR

:: ===========================================================================
::  [9] VER LOGS
:: ===========================================================================
:VER_LOGS
cls
echo.
echo  =============================================================
echo   LOGS DEL DEVKIT
echo  =============================================================
echo.

if not exist "%LOGDIR%" (
    echo   [!] No hay logs todavia.
    call :WAIT_KEY
    goto :MENU
)

echo   Archivos de log disponibles:
echo.

set "LOG_COUNT=0"
for %%F in ("%LOGDIR%\vigia_devkit_*.log") do (
    set /a LOG_COUNT+=1
    echo     [!LOG_COUNT!] %%~nxF  ^(%%~zF bytes^)
)

if !LOG_COUNT! EQU 0 (
    echo   [!] No se encontraron archivos de log.
    call :WAIT_KEY
    goto :MENU
)

echo.
echo   [A]  Abrir ultimo log en el Bloc de notas
echo   [B]  Abrir carpeta de logs
echo   [C]  Limpiar todos los logs
echo   [0]  Volver al menu
echo.
set /p "LOG_OPT=   Selecciona [A-C, 0]: "

if /i "%LOG_OPT%"=="A" (
    set "LAST_LOG="
    for %%F in ("%LOGDIR%\vigia_devkit_*.log") do set "LAST_LOG=%%F"
    if defined LAST_LOG (
        start "" notepad "!LAST_LOG!"
        echo   [OK] Log abierto en Bloc de notas.
    ) else (
        echo   [!] No se encontro ningun log.
    )
)

if /i "%LOG_OPT%"=="B" (
    start "" explorer "%LOGDIR%"
    echo   [OK] Carpeta de logs abierta.
)

if /i "%LOG_OPT%"=="C" (
    set /p "CONFIRM_DEL=   Seguro que deseas eliminar todos los logs? (S/N): "
    if /i "!CONFIRM_DEL!"=="S" (
        del /q "%LOGDIR%\vigia_devkit_*.log" 2>nul
        echo   [OK] Logs eliminados.
        call :LOG "Logs limpiados por el usuario"
    ) else (
        echo   Cancelado.
    )
)

if "%LOG_OPT%"=="0" goto :MENU

timeout /t 2 >nul
goto :VER_LOGS

:: ===========================================================================
::  [E] INICIAR ELECTRON EN DESARROLLO (PRUEBA OFFLINE)
:: ===========================================================================
:RUN_ELECTRON
cls
echo.
echo  =============================================================
echo   EJECUTAR APP DE ESCRITORIO ELECTRON (Prueba Offline)
echo  =============================================================
call :LOG "Iniciando Electron para prueba local"

echo   [*] Asegurandose de que el servidor Astro esta activo...
start "VIGIA - Astro Dev Server" cmd /k "cd /d "%ADMIN%" && pnpm dev"
echo   [..] Esperando inicializacion del servidor (5 segundos)...
timeout /t 5 /nobreak >nul

echo   [*] Lanzando ventana de Electron...
cd /d "%ADMIN%"
start "VIGIA - Electron Shell" cmd /c "pnpm electron:start"

call :LOG "Electron de prueba iniciado"
timeout /t 3 >nul
goto :MENU

:: ===========================================================================
::  SALIR
:: ===========================================================================
:SALIR
cls
echo.
echo  +=============================================================+
echo  ^|                                                             ^|
echo  ^|         VIGIA DevKit - Sesion Finalizada                    ^|
echo  ^|                                                             ^|
echo  ^|   Servidores abiertos seguiran activos en sus               ^|
echo  ^|   ventanas correspondientes. Cierralos manualmente.        ^|
echo  ^|                                                             ^|
echo  +=============================================================+
echo.
call :LOG "Sesion del DevKit finalizada"
echo   Hasta luego!
echo.
timeout /t 3 >nul
endlocal
exit /b 0

