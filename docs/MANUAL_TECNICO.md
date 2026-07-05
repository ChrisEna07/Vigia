# Manual Técnico y de Infraestructura - VIGIA

Este manual detalla los aspectos técnicos, arquitectura de software, base de datos y despliegue del ecosistema **VIGIA**.

---

## 🏗️ Arquitectura de Software

El ecosistema de VIGIA opera bajo un modelo de arquitectura cliente-servidor multitenant híbrido, conectado a la nube por defecto, con capacidades de bypass desconectadas de internet en modo de escritorio.

```
       +-------------------------------------------------------+
       |                  Supabase (Cloud)                     |
       |  - Auth (Manejo de Sesiones JWT)                      |
       |  - Postgres (Almacenamiento e Índices)                |
       |  - Realtime Engine Realtime Message Delivery          |
       |  - RLS Engine (Aislamiento de Datos por Tenant ID)    |
       +----------------------------+--------------------------+
                                    |
                 +------------------+------------------+
                 |                                     |
    +------------v------------+           +------------v------------+
    |    Aplicación Web       |           |     Aplicación Móvil    |
    |   (Astro / React / JS)  |           |     (Flutter / Dart)    |
    +------------+------------+           +-------------------------+
                 |
    +------------v------------+
    |   Versión Escritorio    |
    |  (Electron Offline App) |
    +-------------------------+
```

---

## 🔒 Modelo Multitenancy y Seguridad de Datos (RLS)

El principio fundamental del sistema es que la información de un cliente jamás debe mezclarse con la de otro. Esto se logra mediante dos niveles de seguridad concéntricos:

1. **Row Level Security (RLS) en Supabase:**
   En cada tabla crítica de base de datos se activa RLS y se implementa una directiva Postgres para restringir el acceso:
   ```sql
   ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "turnos_ver_misma_institucion" ON public.turnos 
     FOR SELECT USING (
       institucion_id = (select institucion_id from public.usuarios where id = auth.uid())
     );
   ```
   Cualquier petición (SELECT, INSERT, UPDATE, DELETE) realizada a Supabase es analizada por la base de datos comparando el ID del usuario del token JWT contra la institución asignada. Si no coinciden, Supabase rechaza o vacía los datos de forma nativa.
2. **Aislamiento en Código Cliente:**
   Tanto en la app web como en la móvil, las consultas de datos filtran explícitamente por el `institucion_id` activo del usuario en sesión, garantizando que el tráfico de red esté optimizado y segmentado.

---

## 🗄️ Esquema de Base de Datos (PostgreSQL)

### Tabla: `public.instituciones`
Almacena las empresas de seguridad clientes del sistema.
* `id` (UUID, PK): Identificador único de la empresa.
* `nombre` (TEXT): Nombre comercial de la empresa.
* `slug` (TEXT, UNIQUE): Slug para enrutamiento.
* `plan_suscripcion` (TEXT): Tipo de plan (`basico`, `vigia-pro`, `offline`).
* `monto_mensual` (NUMERIC): Valor de cobro mensual.
* `estado_suscripcion` (TEXT): Estado (`activa`, `vencida`).
* `fecha_vencimiento` (DATE): Fecha de corte del servicio.
* `acepta_datos_ley` (BOOLEAN): Consentimiento de Habeas Data corporativo.
* `fecha_aceptacion_ley` (TIMESTAMPTZ): Registro temporal de aceptación.
* `en_demo` (BOOLEAN): Bandera de período de prueba.
* `limite_demo` (DATE): Fin de la demo gratuita (20 días).

### Tabla: `public.usuarios`
Perfiles de usuarios (SuperAdmin, Admin de Empresa y Vigilantes).
* `id` (UUID, PK): Referencia al Auth de Supabase.
* `institucion_id` (UUID, FK): Empresa a la que pertenece (nulo si es SuperAdmin).
* `nombre_completo` (TEXT): Nombre real.
* `email` (TEXT, UNIQUE): Correo de acceso.
* `rol` (TEXT): Rol de usuario (`superadmin`, `admin_institucion`, `vigilante`).
* `activo` (BOOLEAN): Estado de activación.
* `dias_laborales` (TEXT[]): Horario asignado de la semana (ej. `['lunes|06:00|18:00', 'martes|06:00|18:00']`).

### Tabla: `public.turnos`
Bitácora de control de horas de los vigilantes.
* `id` (UUID, PK): Identificador del registro.
* `institucion_id` (UUID, FK): Empresa del turno.
* `vigilante_id` (UUID, FK): Vigilante que opera.
* `inicio_turno` (TIMESTAMPTZ): Fecha y hora de ingreso.
* `fin_turno` (TIMESTAMPTZ, Nullable): Fecha y hora de salida.
* `motivo_cierre_anticipado` (TEXT, Nullable): Justificación si la salida es antes de hora.
* `motivo_entrada_tarde` (TEXT, Nullable): Justificación si la entrada es tarde (>30 mins del horario asignado).

### Otras Tablas Críticas
* `bitacora_accesos`: Registro general de ingresos/salidas (peatones, vehículos, equipos).
* `modulos_config`: Control de estado (activo/inactivo) de módulos (Vehículos, Equipos, Visitantes) por cliente.
* `mensajes`: Mensajería instantánea en vivo entre vigilante de turno y administrador del cliente.
* `soporte_tickets`: Reporte de incidencias enviadas a soporte técnico.

---

## ⚙️ Configuración y Variables de Entorno

### Configuración del Panel Web (`admin-panel/.env`)
Crea este archivo en la raíz del directorio `admin-panel`:
```env
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima-jwt
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role-privada (para bypass de cuentas)
```

### Configuración de la App Móvil (`vigilante_app/lib/core/config/supabase_config.dart`)
La dirección de conexión se encuentra configurada estáticamente:
```dart
static const _url = 'https://tmfdvbnbcyzeicodmplr.supabase.co';
static const _anonKey = 'tu-clave-anonima-jwt';
```

---

## 📦 Guía de Compilación de Producción

### 1. Compilar Panel Web
Dentro del directorio `admin-panel`:
```bash
pnpm install
pnpm build
```
Esto generará los assets del cliente y servidor en la carpeta `dist/`.

### 2. Generar el Instalador de Escritorio Offline (`.exe`)
La versión offline utiliza Electron para encapsular el panel localmente:
```bash
# 1. Asegúrate de compilar el sitio Astro
pnpm build
# 2. Empaqueta el instalador portable y ejecutable
pnpm electron:make
```
El archivo de instalación final se guardará en `admin-panel/dist/Vigia Setup *.exe`.

### 3. Compilar APK Android (Flutter)
Dentro del directorio `vigilante_app`:
```bash
flutter pub get
flutter build apk --release
```
La APK de producción se generará en `build/app/outputs/flutter-apk/app-release.apk`.
