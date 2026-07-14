# Zymo Ally — Sincronización de datos maestros desde el directorio intranet

## Contexto

El formulario "Crear ticket PQR" (F1, ya en producción) es visualmente correcto pero funcionalmente vacío: los selects de Área, Plataforma, Supervisor, Analista y Coordinador dependen de `ZymoConfigList`/`ZymoAreaPrefix`, tablas propias de `zymoally-backend` que hoy solo tienen valores semilla genéricos ("Supervisor PQR", "CEDI principal", etc.) sin relación con los datos reales de la intranet.

Investigación confirmó que **ya existe duplicación** de estos maestros entre módulos:
- **Área**: fuente real única, `GET /areas` (backend Python), ya usada por OC.
- **Plataforma**: ya duplicada dos veces — OC reusa Sedes (`GET /sedes?para_solicitudes_oc=true`), Tareas V2 tiene su propia copia aislada en `task-db`. Si Zymo Ally sigue con su lista estática, sería la tercera copia del mismo dato.
- **Personas** (Supervisor/Analista/Coordinador): existe el directorio T&C (`GET /tc/personas`, 164 personas), pero requiere el permiso `mod_tc` — la mayoría del personal que crea tickets no lo tiene.

## Decisión de arquitectura — patrón a clonar, no paquete compartido

Cada backend Node (`zymoally-backend`, `task-backend`, `helix-backend`, `sig-backend`) tiene su propia base de datos separada — no hay una sola BD compartida entre ellos. "Reutilizable" aquí significa **un patrón de código documentado para clonar y adaptar** (mismo criterio que ya sigue todo el repo: `middleware/auth.ts`, el patrón `ListConfig`/`ZymoConfigList`), no una librería npm interna versionada. Este documento describe el patrón implementado en `zymoally-backend`; queda como referencia para portarlo a otros backends cuando haga falta.

## El pipeline (según el diagrama del usuario)

```
Filtro por herramienta          → cada módulo decide qué subconjunto de datos maestros le sirve
        ↓
Datos maestros → Directorio intranet   → backend Python, fuente única de verdad (áreas, sedes, personas)
        ↓
[Filtro de datos] (cilindro)    → tabla local del módulo (ZymoAreaPrefix / ZymoConfigList), upsert por id externo
        ↓
Configuración de listas         → el admin sigue pudiendo editar/ocultar/reordenar encima de lo sincronizado
        ↓
   (abanico de consumidores)    → los distintos selects del formulario de creación
```

## Auth para las llamadas de sync — token de servicio, no `X-Internal-Key`

`zymoally-backend` ya conoce `SECRET_KEY` (vía `env_file: ./backend/.env` en `docker-compose.yml`, mismo secreto HS256 que firma los JWT de usuarios). En vez de forward del JWT del usuario que aprieta el botón (que puede no tener `mod_tc`) o de agregar un mecanismo `X-Internal-Key` nuevo al backend Python, `zymoally-backend` **firma su propio JWT de servicio** con `role: "admin"` (bypass universal ya establecido en todo el backend Python: `role === "admin" → true`), TTL corto (5 min), usado únicamente para las llamadas internas de sync. Cero cambios en el backend Python.

```ts
function mintServiceToken(): string {
  return jwt.sign(
    { id: 0, role: "admin", sede: "", area: "", email: "sync@zymoally.internal" },
    env.SECRET_KEY,
    { expiresIn: "5m" },
  )
}
```

## Qué se sincroniza (F1 de esta iniciativa — alcance de esta fase)

| Campo del formulario | Fuente intranet | Filtro por herramienta | Destino local |
|---|---|---|---|
| Área | `GET /areas` → `[{id, name}]` | ninguno, todas | `ZymoAreaPrefix` (agrega `externalId`, `syncedAt`) |
| Plataforma | `GET /sedes?para_solicitudes_oc=true` → `[{id, name, visible_en_solicitudes_oc}]` | mismo filtro que ya usa OC | `ZymoConfigList` listType=`platforms` (agrega `externalId`, `syncedAt`) |
| Supervisor / Analista / Coordinador | `GET /tc/personas?estado=Activo&limit=500` → `{total, items:[{id, nombre, ...}]}` | solo activos, sin filtrar por cargo (ver simplificación abajo) | `ZymoConfigList` listType=`personas` (agrega `externalId`, `syncedAt`) |

**Simplificación deliberada:** los 3 campos de personas (Supervisor/Analista/Coordinador) comparten la MISMA lista sincronizada (`listType: "personas"`) en vez de 3 listas separadas — resolver por `cargo_id` específico requiere primero buscar el cargo por nombre en `/tc/cargos` (endpoint que pide `area_id`, sin búsqueda global por nombre de cargo), complejidad no justificada hoy dado que las 3 listas actuales de todos modos tenían un único valor genérico cada una. Si más adelante se necesita filtrar por rol real, se revisita.

**Prefijo de área nueva sin mapeo:** cuando el sync trae un área que no tiene entrada previa en `ZymoAreaPrefix`, se deriva un prefijo automático (primeras 3-4 consonantes del nombre en mayúsculas, vía la función `normalizePrefix` ya existente) — editable después por el admin. No bloquea el sync.

## Upsert sin destruir personalizaciones del admin

`externalId` (nuevo campo nullable en `ZymoAreaPrefix` y `ZymoConfigList`) es la clave estable de matching — no el nombre, que puede cambiar en la intranet real sin que eso deba crear un duplicado. El sync:
- Si existe una fila con ese `externalId`: actualiza `area`/`label` y `syncedAt`, **no toca** `isActive` ni `prefix`/`sortOrder` (así una entrada que el admin desactivó sigue desactivada tras el próximo sync).
- Si no existe: la crea, `isActive: true` por defecto.
- Nunca borra filas — una persona/área que desaparece de la intranet simplemente deja de recibir `syncedAt` nuevo; el admin decide si la desactiva.

## Disparo del sync

Ambos comparten la misma función `syncMasterData()`:
1. **Cron** — `node-cron` (paquete nuevo, ninguno de los backends Node lo tiene hoy; primero en usarlo, documentado como patrón). Horario `0 6,12,16 * * *` (6am, 12pm, 4pm).
2. **Botón manual** — `POST /api/tickets/config/sync`, gate `mod_tickets_config`. Vive en un botón mínimo, **no** en una pantalla de configuración completa — esa pantalla es F5 y además el usuario indicó que cuando se construya el directorio de la intranet va a existir un portal de configuración global por permisos/áreas que reemplazará este botón temporal. No construir nada permanente alrededor de este botón.

## Fuera de alcance de esta fase

- Portal de configuración global por permisos/áreas (mencionado por el usuario como visión futura, no se construye ahora).
- Pantalla completa de edición/ocultar/reordenar entradas sincronizadas — sigue siendo F5.
- Filtrado de personas por cargo/rol específico (supervisor real vs analista real).
- Aplicar este patrón a otros backends Node (helix/task/sig) — este documento queda como referencia para cuando se necesite, no se toca código de otros backends ahora.
