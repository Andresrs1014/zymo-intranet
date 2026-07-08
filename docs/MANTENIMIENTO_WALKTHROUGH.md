# Mantenimiento — Walkthrough funcional (estado 2026-07-08)

Documento de referencia paso a paso del flujo completo de Mantenimiento, con el estado real después de los fixes de hoy. Úsalo para probar manualmente el proceso de punta a punta.

**Nota sobre la FSM real:** el flujo termina en `completado`. El estado `cerrado` existe en el modelo pero **no hay ninguna transición que lleve ahí** — ningún botón, ningún endpoint. Si esperabas un paso de "cerrar", no existe todavía.

```
solicitud → programado → ejecucion → completado
    ↓            ↓
cancelado    cancelado
```

---

## Paso 1 — Crear la solicitud

Dos puntos de entrada, ahora con los mismos campos (antes divergían):

- **Administrativo → Mantenimiento → "Nueva solicitud"** (`/mantenimiento/nueva`) — solo si tu rol puede "gestionar" mantenimiento.
- **Operativo → Mis Solicitudes → "Nueva solicitud" → pestaña "Solicitud de Mantenimiento"** (`/operativo/nueva-solicitud?tipo=mantenimiento`) — cualquiera con acceso a Operativo o Mantenimiento.

Llena: título, descripción, tipo de mantenimiento, clasificación (correctivo/preventivo — preventivo pide fecha próxima, no puede ser pasada), modalidad (interno/externo — externo pide foto de evidencia "antes"), prioridad, monto estimado (opcional).

**Verificar:** al enviar, te lleva al detalle de la solicitud recién creada (`/mantenimiento/{id}`), no al listado.

**Gate a vigilar:** si `monto_estimado > $2.000.000`, la solicitud necesita 3 aprobaciones antes de poder programarse (ver Paso 3).

---

## Paso 2 — Asignar un auxiliar

**Importante:** no hay botón de "asignar manualmente" conectado en la UI (el endpoint existe pero está huérfano). El flujo real es autoasignación:

- El auxiliar de mantenimiento entra a **Mantenimiento → pestaña "Disponibles"** y pulsa **"Tomar"** en la solicitud que quiere atender.
- Para mantenimiento externo con proveedor, la asignación se hace desde el panel de compras (`ParExternoPanel`).

**Verificar:** una vez tomada, la solicitud muestra el nombre del auxiliar asignado en el detalle.

---

## Paso 3 — Aprobaciones (solo si monto > $2.000.000)

En el detalle de la solicitud, botón **"Aprobar — {rol}"** para los roles `dir_administrativa`, `gerencia_operaciones`, `gerencia_general`. Se necesitan las 3 para poder avanzar a "programado".

⚠️ **Hallazgo de seguridad, no arreglado hoy:** este endpoint (`POST /solicitudes/{id}/aprobacion`) no valida el rol en el backend — solo exige estar logueado. El control de "quién puede aprobar" hoy vive solo en el frontend. Vale la pena una tarea aparte para esto.

---

## Paso 4 — Programar

Botón **"Marcar como programado"** en el detalle — solo visible/habilitado si no hay gate de aprobación pendiente. Requiere permiso de gestión de Mantenimiento (en la práctica, rol `admin`).

**Verificar:** el estado cambia a "Programado" y aparece en la pestaña correspondiente del listado.

---

## Paso 5 — Compartir el acceso móvil con el auxiliar

Panel **"Acceso móvil"** en el detalle (visible solo para quien gestiona, y solo si el estado es solicitud/programado/ejecución). Botones: **"Copiar link"**, **"Enviar WhatsApp"**, **"Descargar QR"**, **"Regenerar link"**.

- **Si el auxiliar YA fue asignado** (Paso 2): genera un link de **portal permanente** (`/m/portal/{token}/{id}`) — sin expiración. Esta es la ruta más común.
- **Si todavía NO hay auxiliar asignado**: genera un link **temporal** (`/m/q/{token}`).

**Estado de cada uno después de los fixes de hoy:**
- ✅ Link temporal (`/m/q/{token}`) → abre el hub móvil real (tema oscuro, botones grandes, pensado para celular). Arreglado hoy.
- ⚠️ Portal permanente (`/m/portal/{token}/{id}`) → **sigue abriendo la UI de escritorio** (tabla con scroll horizontal, sidebar fijo) metida en un contenedor angosto. No se tocó hoy — es un sistema de tokens separado (`portal_tokens.py`) y arreglarlo bien necesita más tiempo del que había hoy.

**Para probar el celular hoy:** usa el escenario "sin auxiliar asignado todavía" para ver el flujo mobile-first funcionando. El escenario "ya asignado" seguirá viéndose como escritorio hasta que se arregle el portal.

---

## Paso 6 — El auxiliar trabaja la solicitud (desde el celular)

Con el link del Paso 5 abierto en el teléfono:

1. **Hub "Mis tareas"** — lista de solicitudes activas asignadas a ese auxiliar.
2. Toca una tarjeta → **detalle** de la solicitud.
3. Botón **"VOY EN CAMINO"** — pasa la solicitud a `ejecucion`. (Equivalente de escritorio: botón "Iniciar ejecución" en el detalle, para el gestor.)
4. Botón **"TERMINÉ — SUBIR FOTO"** — abre la cámara del celular directo, pasa a `completado`. **Obligatorio subir foto** — si no hay evidencia, el botón no deja avanzar. (Equivalente de escritorio: "Marcar como completado", deshabilitado sin evidencia.)
5. Botón **"SOLICITAR COMPRA / REPUESTO"** — crea una OC vinculada a la solicitud, sin salir de la vista del celular.

**Gate de evidencia:** mantenimiento interno solo pide 1 foto (al completar). Mantenimiento externo pide 2: "antes" (obligatoria al crear la solicitud) y "después" (obligatoria al completar).

---

## Paso 7 — Cancelar (camino alterno)

Botón **"Cancelar solicitud"**, visible solo en estado `solicitud` o `programado` — una vez en `ejecucion` ya no se puede cancelar desde la UI (la FSM del backend tampoco lo permite).

---

## Resumen de lo que quedó pendiente (no arreglado hoy, por tiempo)

1. **Portal permanente sigue siendo desktop-first** — el caso más común (auxiliar ya asignado) no tiene la experiencia móvil real todavía.
2. **Aprobaciones sin validar rol en backend** — riesgo de seguridad, cualquier usuario logueado podría aprobar vía API directa.
3. **3 implementaciones duplicadas de captura de foto con cámara** (`FotoEvidenciaField.tsx`, `MantenimientoCampoAcciones.tsx`, dentro de `MantenimientoMobilePage.tsx`) — funcionan, pero cualquier mejora futura (compresión de imagen, por ejemplo) hay que aplicarla 3 veces.
4. **Endpoint `/asignar` manual huérfano** — existe pero ninguna UI lo usa; la asignación real es autoasignación desde el pool.
5. **Flujo "retroactivo"** (registrar trabajo ya hecho) — backend listo, sin UI conectada.
6. **Estado `cerrado`** — existe en el modelo, sin ninguna transición real hacia él.
