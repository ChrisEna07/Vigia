# Casos de Uso e Historias de Usuario - VIGIA

Este documento detalla los casos de uso principales y las historias de usuario para pruebas y verificación de calidad (QA) del sistema **VIGIA**.

---

## 📋 Historias de Usuario

### Historia de Usuario 1: Registro de Turno y Trazabilidad de Horarios
* **Como** Administrador de Empresa,
* **Quiero** que el sistema obligue a los vigilantes a justificar sus ingresos tardíos y salidas anticipadas,
* **Para** mantener una trazabilidad absoluta de la puntualidad del personal y evitar fallas en la cobertura de seguridad.

### Historia de Usuario 2: Seguridad y Privacidad Multitenant
* **Como** Cliente de Empresa de Seguridad Privada,
* **Quiero** tener la certeza absoluta de que ninguna otra empresa registrada en la plataforma pueda ver la bitácora de accesos, novedades, vigilantes ni datos privados de mi condominio,
* **Para** cumplir con las regulaciones de protección de datos (Habeas Data) y mantener la confidencialidad de la operación.

---

## 🔄 Casos de Uso Operacionales (Flujos Detallados)

### Caso de Uso 1: Inicio de Turno con Llegada Tarde
* **Actor Principal:** Vigilante de Turno.
* **Precondiciones:** El vigilante tiene una cuenta activa y un horario asignado (ej. Lunes de 06:00 a 18:00). El vigilante está intentando iniciar turno a las 06:45 AM (más de 30 minutos de retraso).
* **Flujo Principal:**
  1. El vigilante abre la app móvil e inicia sesión.
  2. Navega a la pestaña **Turno** y pulsa el botón **"Iniciar Turno"**.
  3. El sistema móvil detecta que la hora actual supera en 45 minutos la hora de inicio asignada (06:00 AM).
  4. El sistema bloquea el ingreso directo y despliega el diálogo **"Justificación de Ingreso Tardío"**.
  5. El vigilante ingresa el motivo (ej. "Retraso en el transporte público debido a lluvia").
  6. Pulsa **"Guardar e Iniciar"**.
  7. El turno se registra como activo, guardando la fecha de inicio y el motivo del retraso en la base de datos.
* **Resultado Esperado:** El turno se activa en la app móvil. En el panel web del administrador, en el historial de turnos del vigilante, aparece el registro con un indicador ámbar de **`LLEGADA TARDE`** y el motivo ingresado.

---

### Caso de Uso 2: Salida Anticipada de Turno
* **Actor Principal:** Vigilante de Turno.
* **Precondiciones:** El vigilante tiene un turno activo iniciado. Su turno programado finaliza a las 06:00 PM. El vigilante intenta finalizar el turno a las 05:15 PM (antes del horario asignado).
* **Flujo Principal:**
  1. El vigilante abre la app móvil y navega a la pestaña **Turno**.
  2. Pulsa el botón **"Terminar Turno"**.
  3. El sistema móvil compara la hora actual (05:15 PM) contra el fin de turno programado (06:00 PM) y detecta que es una salida anticipada.
  4. La app detiene la acción y muestra el diálogo **"Justificación de Cierre Anticipado"**.
  5. El vigilante ingresa la justificación (ej. "Relevo de guardia se presentó antes para inducción").
  6. Pulsa **"Guardar y Terminar"**.
  7. El turno se marca como finalizado y se cierra la sesión de turno activa.
* **Resultado Esperado:** El turno se cierra correctamente. En el panel web del administrador, el registro de turno de ese vigilante aparece marcado en rojo con la etiqueta **`SALIDA ANTICIPADA`** y el motivo ingresado.

---

### Caso de Uso 3: Salida de Elementos con Autocompletado (Validación y Bloqueo)
* **Actor Principal:** Vigilante de Turno.
* **Precondiciones:** Un residente o empleado cuenta con una autorización previa en el sistema para retirar un equipo portátil serial `LAP-778`.
* **Flujo Principal (Caso Éxito):**
  1. El vigilante va a la pestaña **Registro** en la app y selecciona **"Salida"**.
  2. Digita el documento del residente y marca la opción **"Lleva consigo un elemento"**.
  3. Digita el código `LAP-778`.
  4. El sistema móvil busca localmente / consulta Supabase y detecta la autorización válida. Autocompleta los datos del portador y la descripción del equipo en la app móvil.
  5. El vigilante pulsa **"Registrar Salida"**.
* **Flujo Alternativo (Caso de Bloqueo):**
  1. El vigilante digita un documento o código sin autorización previa.
  2. El sistema móvil valida los datos y muestra un mensaje de advertencia en color rojo: **"El usuario no tiene una autorización asignada en el sistema"**.
  3. El vigilante no puede realizar el autocompletado y toma las acciones de seguridad correspondientes.
* **Resultado Esperado:** El autocompletado funciona exitosamente solo si existe autorización previa; en caso contrario, se bloquea y se advierte al vigilante en pantalla.

---

### Caso de Uso 4: Bypass de Onboarding del Administrador de Cliente
* **Actor Principal:** Administrador de Empresa Cliente.
* **Precondiciones:** El SuperAdmin ha creado la cuenta del cliente y éste ingresa por primera vez a la plataforma.
* **Flujo Principal:**
  1. El Administrador de Empresa inicia sesión en el panel web.
  2. El sistema intercepta el acceso y detecta que `acepta_datos_ley` es falso.
  3. Despliega de forma bloqueante la pantalla de Onboarding.
  4. El usuario lee y acepta los términos de Habeas Data.
  5. Completa la encuesta de activación de módulos (marca: Vehículos y Equipos, desmarca: Visitantes).
  6. Pulsa **"Finalizar Onboarding"**.
* **Resultado Esperado:** El onboarding se cierra. En la base de datos se guarda la fecha de aceptación de Habeas Data. En la tabla de configuración de módulos de la empresa se activan automáticamente los módulos elegidos, y se notifica al usuario que puede alterarlos en Configuración.
