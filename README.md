# VIGIA - Sistema Táctico de Control de Acceso Perimetral y Bitácora

[![GitHub Release](https://img.shields.io/badge/Release-v1.0.0-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20%7C%20Desktop%20%28Offline%29-blue.svg)]()
[![Database](https://img.shields.io/badge/Database-Supabase%20%2F%20Postgres-purple.svg)]()
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)]()

**VIGIA** es un ecosistema de software táctico de calidad empresarial diseñado para el control de acceso físico, gestión de portería, bitácora en tiempo real de personal y auditoría de seguridad perimetral. Proporciona una solución robusta y multitenant (aislamiento completo entre clientes) que funciona tanto en la nube (Online) como de forma autónoma en computadoras de escritorio locales (Offline).

---

## 📱 Componentes del Ecosistema

El proyecto está compuesto por tres aplicaciones clave:

1. **Panel Web de Administración ([admin-panel](file:///e:/aplicativos%20ChrizDev/Vigia/admin-panel)):**
   * Construido con **Astro**, **React** y **TailwindCSS**.
   * Panel de control comercial para **SuperAdmin** (gestión de clientes, logs de facturación, anuncios globales).
   * Panel de control de **Administradores de Empresa** (onboarding de Habeas Data, gestión de vigilantes, asignación de horarios detallados, chat en vivo, reportes e historial en tiempo real).
2. **Aplicación Móvil ([vigilante_app](file:///e:/aplicativos%20ChrizDev/Vigia/vigilante_app)):**
   * Desarrollada en **Flutter** para Android e iOS.
   * Utilizada por vigilantes/porteros para iniciar turno, registrar accesos (peatonales, vehículos, computadoras portátiles), reportar novedades con evidencias fotográficas y comunicarse con el administrador en tiempo real.
3. **Versión de Escritorio Autónoma (Offline Desktop App):**
   * Integrada mediante **Electron** que envuelve el panel de Astro.
   * Diseñada para funcionar localmente en PCs de portería sin conexión a internet, utilizando una base de datos local y un bypass de inicio rápido.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend Web:** Astro 5.5, React 19, TailwindCSS 4, Vite.
* **Mobile App:** Flutter (SDK 3.x), Riverpod para gestión de estado, Supabase Flutter Client.
* **Desktop Wrapper:** Electron, Electron Builder.
* **Backend & Base de Datos:** Supabase (Postgres, Auth, Realtime Engine, RLS Security Policies).

---

## 📚 Documentación del Proyecto

Hemos preparado manuales detallados para la implementación y uso del ecosistema:

* **[Manual Técnico e Infraestructura (docs/MANUAL_TECNICO.md)](file:///e:/aplicativos%20ChrizDev/Vigia/docs/MANUAL_TECNICO.md):** Arquitectura del sistema, esquema de base de datos Postgres, políticas RLS (Row Level Security), variables de entorno y guía de compilación.
* **[Manual de Usuario y Operación (docs/MANUAL_USUARIO.md)](file:///e:/aplicativos%20ChrizDev/Vigia/docs/MANUAL_USUARIO.md):** Manual detallado para el SuperAdmin, Administrador de Empresa Cliente y Vigilante de Turno.
* **[Casos de Uso e Historias de Usuario (docs/CASOS_USO.md)](file:///e:/aplicativos%20ChrizDev/Vigia/docs/CASOS_USO.md):** Flujos operacionales documentados paso a paso para pruebas de calidad y auditoría.

---

## 🚀 Guía de Inicio Rápido

### Requisitos Previos
* Node.js v18 o superior.
* PNPM (`npm install -g pnpm`).
* Flutter SDK (versión 3.x o superior).

### Ejecutar con el VIGIA DevKit (Recomendado en Windows)
Hemos creado un Centro de Control táctil por lotes interactivo para agilizar el desarrollo:
1. Haz doble clic en el archivo [`vigia_devkit.bat`](file:///e:/aplicativos%20ChrizDev/Vigia/vigia_devkit.bat) en la raíz del proyecto.
2. Selecciona qué acción deseas realizar:
   * **`[1]`** Iniciar Servidor Web de Desarrollo.
   * **`[2]`** Lanzar la App Móvil (Flutter).
   * **`[3]`** Ejecutar el entorno completo (Astro, Flutter y navegadores de prueba).
   * **`[E]`** Ejecutar la App de Escritorio en Electron (Prueba de modo Offline).
   * **`[5]`** Compilar el instalador offline `.exe` empaquetado.
   * **`[7]`** Correr herramienta de diagnóstico de integridad de archivos.

---

## 🔒 Auditoría de Seguridad: Multitenant Completo
El sistema está diseñado de extremo a extremo para evitar filtraciones de datos entre clientes:
* **RLS (Row Level Security):** La base de datos Supabase tiene habilitado RLS en las 15 tablas de producción. Las lecturas, escrituras e inyecciones de datos están estrictamente restringidas al `institucion_id` del usuario autenticado mediante directivas de base de datos a nivel de kernel.
* **Timezone Bypass:** Las validaciones de turno móvil están protegidas contra desfases de hora en emuladores evaluando tanto la hora del dispositivo local como la hora oficial de Colombia (UTC-5).

---

## 📞 Soporte Comercial y Técnico
Para activaciones de demos de prueba (20 días de duración comercial) o licenciamientos del **Plan Vigia Offline**, ponte en contacto con la gerencia comercial al teléfono de contacto del propietario: **3183517802** (Colombia).
