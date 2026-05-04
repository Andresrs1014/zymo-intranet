# Borradores de formularios persistidos en servidor

## Visión

Hoy los formularios de **operativo** (nueva solicitud), **compras** (cotización) y **financiero** (carga/edición de factura y campos relacionados) mantienen el estado solo en el cliente. Un cierre de navegador, apagado del equipo, cambio de PC o sesión cerrada **hace perder el trabajo**, incluidos metadatos de archivos aún no enviados.

**Objetivo:** que exista un **borrador autoritativo en el servidor** asociado al usuario (y al contexto de negocio cuando aplique), recuperable desde cualquier sesión, con soporte para **referencias a archivos** subidos al borrador (no guardar binarios dentro del JSON del formulario).

**No es objetivo** (salvo que se decida explícitamente después): edición colaborativa en tiempo real, borradores anónimos sin login, o sincronización offline completa.

---

## Principios

1. **Fuente de verdad:** el servidor; el cliente puede tener caché opcional solo como mejora de latencia, no como único respaldo.
2. **Archivos:** subir al servidor lo antes posible en el flujo de borrador; el borrador guarda `path` / `file_id` / hashes según convención existente (`temp_*`, `drafts/`, etc.).
3. **Seguridad:** un usuario solo lee/escribe sus borradores (y roles que ya correspondan: compras solo borradores de cotización en solicitudes que pueda ver).
4. **Confirmación:** al enviar el formulario “definitivo” (crear solicitud, crear cotización, guardar factura…), **eliminar o archivar** el borrador y encajar con el flujo actual (estados, emails, etc.).

---

## Alcance por módulo

### A) Operativo — Nueva solicitud (`NuevaSolicitudPage`)

- Borrador por usuario autenticado (y opcionalmente por `tipo_solicitud` compra/mantenimiento).
- Persistir JSON alineado con `SolicitudInternaCreate` + flags auxiliares (ej. ítem desde paquete en URL).
- Fotos/archivos: endpoint de “subida a borrador” que devuelva referencias; el borrador guarda lista de referencias, no `File`.
- Al **crear solicitud** con éxito: invalidar borrador y (si aplica) mover archivos de carpeta borrador a flujo actual de fotos de solicitud.

### B) Compras — Cotización (`CotizacionFormPage`)

- Contexto: ya existe `solicitud_id` y flujo de `extraer` con archivo temporal.
- Borrador **por `solicitud_id` + usuario** (o solo usuario si en el futuro hay varias cot borrador por solicitud, definir regla).
- Persistir payload de formulario + ítems extraídos tras extracción; referencia al archivo de cotización en borrador si aún no se ha creado `CotizacionProveedor`.
- Decidir interacción con **archivo temporal actual** (`temp_{solicitud_id}`): reutilizar, renombrar a `draft_{id}`, o tabla que apunte al path.
- Al **crear cotización** (`POST .../cotizacion`): borrar borrador y seguir lógica existente de mover temp → definitivo.

### C) Financiero — Factura / detalle (`FacturaDetallePage` u otras pantallas editables largas)

- Contexto: `solicitud_id` + posible `factura_id` si ya existe borrador de edición.
- Borrador para **factura en construcción** (campos + validaciones pendientes) y/o **edición larga** antes de “guardar/validar”.
- Archivo PDF factura: misma idea — subida a borrador con referencia.
- Respetar permisos `require_financiero` (o los que ya apliquen).

---

## Modelo de datos (propuesta inicial — abierta a cambio)

**Opción 1 — Tabla única polimórfica**

| Campo        | Notas                                                      |
|-------------|-------------------------------------------------------------|
| `id`        | UUID                                                        |
| `tipo`      | enum: `solicitud_nueva`, `cotizacion`, `factura`           |
| `user_id`   | FK lógica a `intranet` users (int)                         |
| `contexto`  | JSON: `{ "solicitud_id": "...", "factura_id": null }`       |
| `payload`   | JSON del formulario                                         |
| `archivos`  | JSON lista de refs `{ path, nombre_original, mime, ... }`   |
| `updated_at`|                                                             |
| `creado_en` |                                                             |

**Opción 2 — Tablas por módulo** (más explícito, migraciones separadas).

**Recomendación abierta:** empezar con **una tabla** si reduce tiempo; partir en tablas si los campos divergen mucho.

**Base de datos:** hoy OC/financiero están en SQLite separados (`oc.db`, `financiero.db`). Decidir si los borradores viven en `intranet.db` (coherente con `user_id`) o en cada módulo — **sugerencia:** `intranet.db` o nueva `drafts.db` para no acoplar oc/fin con usuarios en el mismo fichero SQLite (hoy users están en intranet). Alternativa práctica: **`intranet.db`** tabla `form_drafts` porque el actor es siempre usuario intranet.

---

## API (borrador)

Endpoints conceptuales (nombres ajustables al estilo del repo):

- `GET /api/borradores/{tipo}` o `GET /api/b...?tipo=&contexto=` — último borrador del usuario para ese contexto.
- `PUT /api/borradores/{tipo}` — upsert (body: payload + contexto).
- `POST /api/borradores/{tipo}/archivo` — multipart, guarda en disco, devuelve referencia; actualiza borrador o devuelve ref para merge en cliente.
- `DELETE /api/borradores/{tipo}?contexto=` — al cancelar explícito o tras submit exitoso (también puede hacerlo el backend en el mismo handler de create).

**Autenticación:** JWT actual en todos.

---

## Almacenamiento en disco

- Directorio dedicado, ej. `/app/data/form_drafts/{user_id}/{draft_id}/` o reutilizar estructura por módulo.
- Límites: tamaño máximo por archivo, extensiones permitidas (alineado a cotización/factura).
- **Limpieza:** job o endpoint admin: borrar borradores con `updated_at` > N días (configurable).

---

## Frontend

1. Al montar página: `GET` borrador; si existe, modal “¿Continuar borrador del {fecha}?”.
2. **Autosave** debounced hacia `PUT` (ej. 1–2 s tras último cambio) para campos serializables.
3. Subida de archivo: flujo que **no dependa** de mantener `File` en memoria para recovery (tras subir, estado muestra “guardado en borrador”).
4. Tras **submit** exitoso: `DELETE` borrador local + invalidar query keys (React Query si aplica).
5. Opcional: `beforeunload` si hay cambios locales no enviados al autosave aún.

---

## Paso a paso (implementación sugerida)

1. **Decisiones de diseño** (reunión breve o comentarios en PR): tabla única vs múltiple; `intranet.db` vs otro; TTL por defecto.
2. **Backend:** migración/create table, modelo Pydantic/SQLModel, router `/api/borradores` (o bajo namespaces existentes), servicio de archivos, tests mínimos de permisos.
3. **Integrar operativo** — hook `useDraft`, wire `NuevaSolicitudPage`.
4. **Integrar cotización** — alinear con `extraer` y temp files; wire `CotizacionFormPage`.
5. **Integrar financiero** — wire `FacturaDetallePage` (o la ruta que corresponda).
6. **Limpieza programada** (APScheduler u otro worker ya usado en el proyecto) o documentar cron manual.
7. **Documentación README interno** para ops: path en disco, variables env, cómo purgar en emergencia.

---

## Criterios de aceptación (borrador)

- [ ] Tras cerrar navegador y volver a entrar, el usuario puede **restaurar** el mismo borrador en la misma pantalla/contexto.
- [ ] Tras **apagar el PC** y abrir desde otro equipo (mismo usuario), el borrador **sigue**.
- [ ] Tras **submit** exitoso del flujo real, el borrador **desaparece** y no reaparece en el siguiente `GET`.
- [ ] Usuario A **no** puede leer borrador de usuario B (probar con dos cuentas).
- [ ] Archivos subidos al borrador **no** quedan huérfanos sin límite (TTL o borrado al confirmar).

---

## Recomendaciones abiertas (para quien implemente)

- **Unificar o no** con el temporal `temp_{solicitud_id}` de cotización: reutilizar evita duplicar lógica; separar evita condiciones de carrera con dos flujos.
- **Frecuencia de autosave:** equilibrio carga en servidor vs pérdida máxima ~1–2 s de tecleo.
- **Conflictos:** si el mismo usuario abre dos pestañas, último write gana (documentar) o versionar con `version` en el borrador.
- **Privacidad en borrador:** no loguear payloads completos en producción.
- **PostgreSQL futuro:** el diseño de tabla UUID + JSON escala igual; solo cambia URL en settings.

---

## Nota para Claude Code / agente implementador

Este documento define la **intención del producto** y un **esqueleto técnico**. Se espera que el implementador **ajuste nombres**, **encaje con routers y convenciones existentes** del repo (`backend/app/routers`, `frontend/src/hooks`, permisos en `deps`), y **divida en PRs** si mejora la revisión (ej. backend primero, luego un front por módulo).
