# Módulo: Borradores de formularios

**Implementado:** 2026-05-04
**Módulos afectados:** Operativo, Compras (OC), Financiero

---

## Propósito

Permite que los formularios de nueva solicitud, cotización y factura mantengan su estado **en el servidor**, no solo en el cliente. Un cierre de navegador, cambio de equipo o sesión expirada no pierde el trabajo en curso.

---

## Arquitectura

```
backend/app/
├── models/draft.py          # Modelo SQLModel FormDraft → tabla form_drafts en intranet.db
├── services/draft_service.py # Lógica de negocio: find, upsert, upload, delete, purge
└── routers/borradores.py    # Transporte HTTP — solo validación y delegación al servicio

frontend/src/hooks/useDraft.ts  # useDraft, useSaveDraft, useDeleteDraft,
                                 # useUploadDraftFile, useAutosaveDraft
```

---

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/borradores?tipo=&solicitud_id=` | Obtener borrador activo del usuario |
| PUT | `/api/borradores` | Crear o actualizar borrador (upsert) |
| POST | `/api/borradores/archivo` | Subir archivo al borrador (multipart) |
| DELETE | `/api/borradores?tipo=&solicitud_id=` | Eliminar borrador y archivos en disco |
| DELETE | `/api/borradores/limpiar?dias=7` | **Admin only** — purga borradores viejos |

Todos los endpoints requieren JWT. El endpoint `/limpiar` requiere rol `admin`.

---

## Tipos de borrador (`tipo`)

| Valor | Formulario |
|-------|------------|
| `solicitud_nueva` | NuevaSolicitudPage (operativo) |
| `cotizacion` | CotizacionFormPage (compras) |
| `factura` | FacturaDetallePage (financiero) |

---

## Almacenamiento en disco

Archivos subidos al borrador:
```
/app/data/form_drafts/{user_id}/{draft_id}/{nombre_archivo}
```

Extensiones permitidas: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.xlsx`, `.xls`, `.doc`, `.docx`
Tamaño máximo por archivo: **20 MB**

---

## Limpieza automática

Un job APScheduler corre cada 24 horas y elimina borradores (y sus archivos en disco) cuyo `updated_at` supera el TTL configurado.

**Variables de entorno:**

| Variable | Default | Descripción |
|---|---|---|
| `DRAFTS_DIR` | `/app/data/form_drafts` | Directorio de archivos de borradores |
| `DRAFT_TTL_DAYS` | `7` | Días hasta purga automática |

**Purga manual de emergencia:**
```
DELETE /api/borradores/limpiar?dias=1    # borra todo con más de 1 día
```

---

## Comportamiento en el cliente

1. Al montar la página: se consulta el borrador; si existe → modal "¿Continuar borrador del [fecha]?"
2. Mientras editas: autosave debounced cada **1500 ms**
3. Al hacer submit exitoso: el borrador se elimina automáticamente
4. Al descartar: el borrador se borra del servidor

---

## Seguridad

- Un usuario solo puede leer/escribir sus propios borradores (`user_id` del JWT).
- El endpoint de limpieza masiva requiere rol `admin`.
- Los payloads de borradores **no se loguean** en producción.
- Los archivos se validan en extensión y tamaño antes de guardarse.

---

## Volumen Docker

El directorio `DRAFTS_DIR` debe estar en el mismo volumen persistente que `facturas/` y `proformas/`. Verificar que `docker-compose.yml` monte `/app/data` como volumen.
