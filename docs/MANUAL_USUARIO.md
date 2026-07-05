# Manual de Usuario y Guía de Operación - VIGIA

Este documento describe el flujo de operación para cada uno de los roles dentro del ecosistema **VIGIA**.

---

## 👑 1. Rol: Super Administrador (SuperAdmin)

El SuperAdmin tiene el control comercial global del ecosistema y opera únicamente desde el panel web de control de plataforma.

### Flujo de Operación:
1. **Acceso al Panel:**
   * Ingresa mediante el navegador web a la ruta del portal.
   * Introduce las credenciales de administración global de la plataforma.
2. **Tablero Comercial (Dashboard):**
   * Visualiza métricas financieras en pesos colombianos (MRR Facturación Potencial, Ingreso Bruto Real y Ganancias Netas descontando hosting/SMS).
   * Visualiza el número de clientes totales agrupados por estado (Suscripción Activa, Prueba Demo, Suscripción Inactiva).
3. **Módulo de Captación y Ventas:**
   * **Buscador de Empresas Embebido:** Utiliza el buscador integrado para buscar prospectos (conserjerías, empresas de seguridad) sin salir del sistema. Si tu navegador bloquea el frame por directivas de seguridad locales, haz clic en **`[Abrir Externo ↗]`**.
   * **Envío de Propuestas:** Completa el nombre y correo del prospecto. Se cargará una propuesta comercial redactada automáticamente con los precios de los 3 planes vigentes y el teléfono directo del propietario (**3183517802**). Puedes editar el texto y hacer clic en **"Enviar WhatsApp"** o **"Enviar por Email"** para despachar la propuesta. El sistema guardará el log de la invitación.
4. **Módulo de Clientes:**
   * Permite crear nuevas empresas de seguridad e ingresar sus datos.
   * Permite activar periodos Demo (20 días) o suscripciones pagadas (30 días).
   * Al crear el cliente, el panel generará un **comprobante de acceso en PDF** con las credenciales temporales del administrador y opciones rápidas para enviarlas por WhatsApp o Email.
   * **Bypass de Enlace:** Si generas el PDF localmente en `localhost`, el sistema detectará el puerto y reemplazará automáticamente el enlace con la dirección de producción oficial (`https://vigia-app.com`) para evitar que el cliente reciba un enlace incorrecto.

### Operación en Modo Offline (Desconectado):
Cuando el sistema se ejecuta de forma local autónoma (ej. a través de Electron):
* Inicia sesión usando cualquier correo y la contraseña maestra **`ChrizDev07`**.
* Al acceder al panel, se activará el **Módulo Especial de Gestión Offline** en la parte superior.
* Ingresa el nombre de la empresa cliente, el correo del administrador y la contraseña del cliente. Haz clic en **"Crear Cuenta de Cliente Offline"**.
* El sistema guardará este usuario localmente, permitiendo iniciar sesión como administrador de cliente en esa máquina de forma 100% offline.

---

## 🏢 2. Rol: Administrador de Empresa Cliente

Es el encargado de administrar el control de seguridad de su respectiva institución (condominio, edificio corporativo, parque industrial).

### Flujo de Operación:
1. **Acceso y Onboarding Inicial:**
   * Al ingresar por primera vez, el sistema desplegará de forma obligatoria la ventana de Onboarding.
   * **Paso 1 (Habeas Data):** Acepta el consentimiento de políticas de datos personales bajo la ley colombiana.
   * **Paso 2 (Encuesta):** Selecciona qué módulos registrará el personal de portería (Vehículos, Equipos/Computadoras, Visitantes). Al guardar, el sistema activará de forma automática estas opciones y configurará la portería.
2. **Gestión de Vigilantes:**
   * Ve al menú de **Vigilantes**.
   * Crea las cuentas de acceso para tu personal de portería (vigilantes/conserjes).
   * **Configuración de Horarios:** Haz clic en **"Asignar Horario"**. Se abrirá un modal espacioso de alto contraste donde puedes elegir los días de la semana y los rangos de horas específicos en los que cada vigilante tiene autorizado iniciar turno (ej. Lunes de 06:00 a 18:00).
   * **Refrescar Credenciales:** Si un vigilante pierde su acceso, puedes ver sus detalles y hacer clic en **"Restablecer Credenciales"** para generar una clave temporal y enviársela.
3. **Monitoreo en Tiempo Real:**
   * **Dashboard:** Visualiza contadores de vigilantes activos, registros del día y gráficos de flujo.
   * **Historial en Vivo:** Muestra una lista actualizada al instante de los últimos ingresos y salidas con botones rápidos para auditar el detalle.
   * **Chat de Turno:** Chatea en tiempo real con el vigilante que está en la portería física.
   * **Reportes:** Visualiza las marcas de turno de tus vigilantes. Si un vigilante ingresó tarde, el sistema mostrará la marca junto con la etiqueta naranja **`LLEGADA TARDE`** y el motivo. Si salió antes de hora, mostrará la etiqueta roja **`SALIDA ANTICIPADA`** y el motivo correspondiente.

---

## 👮 3. Rol: Vigilante de Turno (App Móvil)

El vigilante opera el sistema desde su dispositivo móvil o tablet en portería.

### Flujo de Operación:
1. **Inicio de Turno:**
   * Abre la aplicación e ingresa con tu correo y contraseña.
   * Ve a la pestaña **Turno** y haz clic en **"Iniciar Turno"**.
   * **Llegada Tarde:** Si inicias tu turno más de 30 minutos después de tu horario programado, la app desplegará un cuadro solicitando el motivo del retraso. Deberás ingresar la justificación para poder activar el turno.
2. **Registro de Accesos:**
   * Una vez iniciado el turno, se desbloqueará la pestaña **Registro**.
   * **Ingreso:** Registra si es un peatón, vehículo o activo. Digita el documento de identidad.
   * **Salida de Elementos con Autocompletado:** Si el usuario tiene una autorización previa registrada en el sistema de salida de computadoras u objetos, al marcar la opción de que lleva un elemento y digitar el código, el sistema autocompletará automáticamente el nombre de la persona y los detalles del elemento. Si el usuario no tiene ninguna autorización asignada, la app le advertirá al vigilante de inmediato.
3. **Reportar Novedades:**
   * Captura novedades relevantes del turno de forma rápida, adjuntando detalles y evidencias fotográficas.
4. **Finalización de Turno:**
   * Al finalizar la jornada, ve a la pestaña **Turno** y haz clic en **"Terminar Turno"**.
   * **Salida Anticipada:** Si intentas terminar tu turno antes de la hora establecida en tu horario, la app te pedirá obligatoriamente que justifiques el motivo de retiro anticipado antes de permitirte registrar la salida.
   * **Control de Cierre:** Para garantizar la trazabilidad del servicio, la app no te permitirá cerrar sesión si aún tienes un turno activo.
