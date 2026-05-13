# Fix: Proceso de Compras (OC) — Duplicados, Archivos y Robustez

**Fecha:** 2026-05-13  
**Contexto:** Tras un git revert + cambio de `.env`, la BD `oc.db` sufrió problemas y se evidenciaron bugs latentes en el módulo de compras.

---

## Problemas identificados

### 🔴 P1 — Solicitudes duplicadas por doble click

**Síntoma:** Al hacer doble click en "Enviar solicitud" mientras carga, se crearon 4 solicitudes idénticas.

**Causa raíz:** Aunque el botón tiene `disabled={crear.isPending}` (línea 847 de `NuevaSolicitudPage.tsx`), existe una **ventana de tiempo** entre el click del usuario y el momento en que React Query cambia `isPending` a `true`. Durante esa ventana (validación del formulario, construcción del payload), el botón sigue habilitado y acepta clicks adicionales.

**Archivos afectados:**
- `frontend/src/pages/operativo/NuevaSolicitudPage.tsx` — líneas 255–297 (`handleSubmit`)
- `frontend/src/hooks/useOC.ts` — líneas 644–656 (`useCrearSolicitudInterna`)
- `backend/app/routers/oc/solicitudes.py` — líneas 199–269 (`crear_solicitud_interna`)

---

### 🟡 P2 — Rutas de archivos hardcodeadas a Docker

**Síntoma:** La subida de fotos/evidencias falla en desarrollo local.

**Causa raíz:** La ruta `_SOLICITUDES_DIR = Path("/app/data/solicitudes")` (línea 839 de `solicitudes.py`) está hardcodeada al path dentro del contenedor Docker. En desarrollo local, `/app/data/` no existe.

**Nota:** Otras rutas (`facturas_dir`, `proformas_dir`, `drafts_dir`) ya están centralizadas en `config.py` como settings. Esta es la única ruta que quedó hardcodeada.

**Archivos afectados:**
- `backend/app/routers/oc/solicitudes.py` — línea 839
- `backend/app/config.py` — agregar setting

---

### 🔴 P3 — Endpoint DELETE de solicitud no existe en backend

**Síntoma:** `useEliminarSolicitud()` en el frontend (useOC.ts línea 862) llama a `DELETE /api/oc/solicitudes/{id}`, pero **ese endpoint no está implementado** en el backend. Cualquier intento de eliminar una solicitud desde la UI dará error 405 Method Not Allowed.

**Archivos afectados:**
- `frontend/src/hooks/useOC.ts` — línea 862 (`useEliminarSolicitud`)
- `frontend/src/pages/oc/SolicitudDetallePage.tsx` — líneas 42 y 115 (import y uso)
- `backend/app/routers/oc/solicitudes.py` — falta el endpoint

**Decisión necesaria:** ¿Se debe implementar el endpoint DELETE en backend, o se debe quitar la opción de eliminar del frontend? Eliminar solicitudes tiene implicaciones en:
- Historial de estados (registros huérfanos)
- Cotizaciones asociadas
- Órdenes de compra generadas
- Archivos/fotos subidos

---

## Solución propuesta

### Fix P1 — Doble protección contra duplicados

#### Frontend: Estado `submitting` inmediato

```tsx
// NuevaSolicitudPage.tsx — handleSubmit
const [submitting, setSubmitting] = useState(false)

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (submitting) return           // ← Guard inmediato
  setSubmitting(true)              // ← Bloqueo antes de validar
  
  const validationError = validarFormulario()
  if (validationError) {
    setError(validationError)
    setSubmitting(false)           // ← Reset si falla validación
    return
  }
  
  try {
    // ... crear solicitud y subir archivos ...
    navigate("/operativo/mis-solicitudes")
  } catch {
    setSubmitting(false)           // ← Reset si falla la creación
    setError("Error al procesar la solicitud...")
  }
}

// Botón: disabled={submitting || crear.isPending || subiendoArchivos}
```

#### Backend: Header de idempotencia (opcional, segunda capa)

```python
# solicitudes.py — crear_solicitud_interna
@router.post("/crear-interna", ...)
async def crear_solicitud_interna(
    payload: SolicitudInternaCreate,
    x_idempotency_key: Optional[str] = Header(default=None),
    ...
):
    # Si hay clave de idempotencia, verificar duplicado
    if x_idempotency_key:
        existente = oc_db.exec(
            select(SolicitudOC).where(
                SolicitudOC.idempotency_key == x_idempotency_key
            )
        ).first()
        if existente:
            return existente  # Retornar la solicitud ya creada
    ...
```

> **Nota:** El header de idempotencia requiere agregar una columna `idempotency_key` a `SolicitudOC`. Es más invasivo — evaluar si la protección frontend sola es suficiente.

**Recomendación:** Implementar solo el fix de frontend (estado `submitting`) que es el más simple y efectivo. El backend ya tiene protección de consecutivo único con reintentos.

---

### Fix P2 — Ruta configurable

```python
# config.py
solicitudes_dir: str = "/app/data/solicitudes"

# solicitudes.py — reemplazar constante
from app.config import settings
_SOLICITUDES_DIR = Path(settings.solicitudes_dir)
```

---

### Fix P3 — Eliminar solicitud (decisión pendiente)

**Opción A:** Implementar `DELETE /api/oc/solicitudes/{id}` en backend
- Solo permitir eliminar solicitudes en estado `nueva` (sin cotizaciones ni historial relevante)
- Hacer cascade delete de fotos y registros de historial
- Registrar en historial como `tipo_accion = "eliminacion"`

**Opción B:** Quitar el botón de eliminar del frontend
- Remover `useEliminarSolicitud` del hook
- Remover import y uso de `SolicitudDetallePage.tsx`
- Las solicitudes se manejan solo con "cancelar"

---

## Archivos que se modificarían

| Archivo | Cambio | Prioridad |
|---------|--------|-----------|
| `frontend/src/pages/operativo/NuevaSolicitudPage.tsx` | Estado `submitting` + guard | 🔴 Alta |
| `backend/app/config.py` | Agregar `solicitudes_dir` | 🟡 Media |
| `backend/app/routers/oc/solicitudes.py` | Usar ruta configurable + (opcionalmente DELETE) | 🟡 Media |
| `frontend/src/hooks/useOC.ts` | (Opcionalmente) idempotency key o quitar eliminar | 🟡 Media |
| `frontend/src/pages/oc/SolicitudDetallePage.tsx` | (Depende de decisión P3) | 🟡 Media |

---

## Preguntas pendientes

1. **P3 — ¿Implementar DELETE o quitar el botón?** Las solicitudes canceladas ya quedan marcadas con estado `cancelada` y registran historial. ¿Es necesario poder eliminarlas físicamente?

2. **Limpieza de datos** — ¿Quieres que limpie las 4 solicitudes duplicadas que se crearon? Puedo hacerlo con un script o manualmente en la BD.

3. **P1 Backend** — ¿Quieres la protección de idempotencia en backend (requiere columna nueva en BD) o solo el fix de frontend es suficiente?
