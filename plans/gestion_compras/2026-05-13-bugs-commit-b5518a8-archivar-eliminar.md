# Bugs pendientes — Commit b5518a8 (archivar solicitudes OC + doble-envío)

**Fecha:** 2026-05-13  
**Commit:** `b5518a8 fix(oc): archivar solicitudes + doble-envio en NuevaSolicitudPage`  
**Estado:** Bugs identificados, pendientes de corregir

---

## 🔴 Bug 1 — `_SOLICITUDES_DIR` se usa antes de definirse (NameError)

**Archivo:** `backend/app/routers/oc/solicitudes.py`

El endpoint `DELETE /{solicitud_id}` (línea 874) usa `_SOLICITUDES_DIR` en la línea 892, pero esa constante se define hasta la línea 941, después del endpoint.

```python
# Línea 892 (USO — dentro de eliminar_solicitud):
fotos_dir = _SOLICITUDES_DIR / str(solicitud_id)

# Línea 941 (DEFINICIÓN — más abajo en el archivo):
_SOLICITUDES_DIR = Path("/app/data/solicitudes")
```

**Impacto:** Cualquier intento de eliminar una solicitud lanzará `NameError: name '_SOLICITUDES_DIR' is not defined`.

**Fix:** Mover la definición de `_SOLICITUDES_DIR` (línea 941) antes del endpoint `eliminar_solicitud` (línea 874). Idealmente, agrupar todas las constantes de rutas al inicio del archivo.

---

## 🟡 Bug 2 — `useArchivarSolicitud` no invalida `mis-solicitudes`

**Archivo:** `frontend/src/hooks/useOC.ts` — línea 862

Si un usuario archiva una solicitud que aparece en la vista "Mis Solicitudes" del operativo, esa lista no se refresca porque falta invalidar la query.

```tsx
// Actual:
onSuccess: (_, solicitudId) => {
  qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
  qc.invalidateQueries({ queryKey: ["oc", "solicitudes", solicitudId] })
  qc.invalidateQueries({ queryKey: ["oc", "kpis"] })
}

// Falta agregar:
qc.invalidateQueries({ queryKey: ["oc", "mis-solicitudes"] })
```

---

## 🟡 Bug 3 — Rutas de archivos hardcodeadas a Docker

**Archivo:** `backend/app/routers/oc/solicitudes.py`

Tres rutas de directorios están hardcodeadas al path dentro del contenedor Docker:

```python
_SOLICITUDES_DIR     = Path("/app/data/solicitudes")     # línea 941
_COTIZACIONES_DIR_SOL = Path("/app/data/cotizaciones")   # línea 870
_OC_DOCS_DIR_SOL      = Path("/app/data/oc_docs")        # línea 871
```

**Impacto:** La subida de fotos y la eliminación de solicitudes fallan en desarrollo local (fuera de Docker).

**Fix sugerido:** Mover a `config.py` como settings (igual que `facturas_dir`, `proformas_dir`, `drafts_dir` que ya están ahí):
```python
# config.py
solicitudes_dir: str = "/app/data/solicitudes"
```

---

## 🟢 Bug 4 — `_COTIZACIONES_DIR_SOL` glob probablemente inútil

**Archivo:** `backend/app/routers/oc/solicitudes.py` — línea 909

```python
for tmp in _COTIZACIONES_DIR_SOL.glob(f"temp_{solicitud_id}.*"):
    tmp.unlink(missing_ok=True)
```

Los temporales de cotización se guardan en la ruta completa de `cot.pdf_path`, no en un directorio aparte llamado `cotizaciones`. Este glob probablemente nunca encuentra archivos. No es crítico (solo limpieza redundante) pero es código muerto.

---

## Checklist de corrección

- [ ] **Mover `_SOLICITUDES_DIR`** antes del endpoint DELETE (Bug 1 — crítico)
- [ ] **Agregar invalidación** de `["oc", "mis-solicitudes"]` en `useArchivarSolicitud` (Bug 2)
- [ ] **Centralizar rutas** en `config.py` (Bug 3 — opcional, funciona en Docker)
- [ ] **Limpiar glob muerto** de `_COTIZACIONES_DIR_SOL` (Bug 4 — opcional)
