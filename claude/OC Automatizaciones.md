# OC Automatizaciones — Documentación Completa

> Módulo de gestión de órdenes de compra integrado en ZYMO Intranet.  
> Arquitectura: FastAPI + SQLModel + SQLite (`oc.db`) · React + TypeScript · Power Automate webhook.

---

## 1. Visión general

OC Automatizaciones digitaliza y automatiza el flujo de solicitudes de compra de ZYMO. El proceso comienza en **SharePoint / Microsoft Forms** (donde los solicitantes llenan el requerimiento), pasa por **Power Automate** que lo envía a la intranet vía webhook, y termina en la generación del documento oficial de Orden de Compra.

```
Solicitante (Forms/SharePoint)
        │
        ▼
  Power Automate  ──►  POST /api/oc/webhook/nueva-solicitud
                              │
                              ▼
                        oc.db  (SolicitudOC estado="nueva")
                              │
                              ▼
                    ZYMO Intranet — Módulo OC
          ┌───────────────────┴───────────────────┐
     Auxiliar Compras                        Directivo / Admin
    asigna · cotiza                         aprueba · rechaza
          │                                       │
          ▼                                       ▼
   Orden de Compra                       Panel de Aprobaciones
   (DOCX / PDF)                          /oc/aprobacion
```

---

## 2. Arquitectura técnica

### Bases de datos

| Base de datos | Archivo | Contenido |
|---|---|---|
| `intranet.db` | `/app/data/intranet.db` | Usuarios, roles, áreas, sedes |
| `oc.db` | `/app/data/oc.db` | Solicitudes, cotizaciones, proveedores, órdenes de compra |

Las dos bases de datos son **independientes**. El JWT se genera con `intranet.db` (auth) y valida en cada request. Las operaciones OC usan `oc.db` vía `get_oc_db`. Los campos `auxiliar_id` y `aprobado_por_id` almacenan IDs de usuario sin FK constraint (cross-DB), validados a nivel de aplicación.

### Roles y permisos

| Rol / Condición | Permisos en OC |
|---|---|
| `role="admin"` | Acceso total |
| `role="directivo"` | Ver solicitudes, aprobar/rechazar cotizaciones, ver KPIs |
| `area="Compras"` | Ver solicitudes, asignar auxiliar, cargar cotizaciones, generar OC |
| Otros roles | Sin acceso al módulo |

Guard backend: `require_compras` (en `app/core/deps.py`) — permite `admin` o `area="Compras"`. El directivo usa `get_current_user` directo en endpoints de aprobación.

---

## 3. Estados de una Solicitud (`EstadoOC`)

```
nueva
  │
  ▼ (asignar auxiliar)
en_cotizacion
  │
  ▼ (cargar cotización)
pendiente_aprobacion
  │
  ├──► aprobada  ──► oc_enviada ──► entregada ──► cerrada
  │
  └──► rechazada ──► (vuelve a en_cotizacion para nueva cotización)
```

| Estado | Descripción | Quién lo dispara |
|---|---|---|
| `nueva` | Solicitud recibida desde PA | Webhook automático |
| `en_cotizacion` | Auxiliar asignado, buscando proveedores | `PATCH /asignar` |
| `pendiente_aprobacion` | Cotización cargada, esperando aprobación | `POST /cotizacion` |
| `aprobada` | Directivo aprobó la cotización | `PATCH /cotizaciones/{id}/aprobar` |
| `rechazada` | Directivo rechazó, hay que volver a cotizar | `PATCH /cotizaciones/{id}/rechazar` |
| `oc_enviada` | Documento OC enviado al proveedor | Manual vía `PATCH /estado` |
| `entregada` | Mercancía recibida | Manual vía `PATCH /estado` |
| `cerrada` | Proceso finalizado | Manual vía `PATCH /estado` |

---

## 4. Integración con Power Automate

### 4.1 Endpoint del webhook

```
POST https://[dominio]/api/oc/webhook/nueva-solicitud
Content-Type: application/json
X-PA-Secret: [valor de OC_WEBHOOK_SECRET]
```

### 4.2 Payload que envía PA

```json
{
  "consecutivo_os": "OS-2025-001",
  "descripcion": "Tóner HP LaserJet Pro M404dn",
  "cantidad": 2,
  "nivel_prioridad": "Alta",
  "solicitante_nombre": "María García",
  "solicitante_email": "m.garcia@zymo.com",
  "categoria": "Consumibles",
  "grupo_articulos": "Papelería e insumos",
  "area": "Operaciones",
  "sede": "Bogotá",
  "cliente": "Interno",
  "condicion": "Nuevo",
  "observaciones_solicitante": "Urgente para proyecto cliente X",
  "placa_ficha": null,
  "fecha_proximo_mantenimiento": null
}
```

> **Nota:** PA envía el campo `area` (nombre del área solicitante). El backend lo mapea internamente a `area_solicitante`.

### 4.3 Respuesta del webhook

```json
{
  "ok": true,
  "solicitud_id": "550e8400-e29b-41d4-a716-446655440000",
  "consecutivo_os": "OS-2025-001"
}
```

- HTTP `201 Created` si es nueva.
- HTTP `201 Created` con el mismo ID si ya existía (deduplicación por `consecutivo_os`).
- HTTP `401 Unauthorized` si el secret es incorrecto.

### 4.4 Configuración del secret en PA

En el flujo de Power Automate, en la acción **HTTP** que llama al webhook:

- **Método:** POST
- **URI:** `https://[dominio]/api/oc/webhook/nueva-solicitud`
- **Headers:**
  ```
  Content-Type: application/json
  X-PA-Secret: [mismo valor que OC_WEBHOOK_SECRET en .env]
  ```
- **Body:** JSON con los campos del formulario

> **Durante desarrollo:** Dejar `OC_WEBHOOK_SECRET=` vacío en `.env` — el webhook acepta cualquier llamada sin validar el header.  
> **En producción:** Generar un secret aleatorio seguro (mínimo 32 chars) y configurarlo igual en PA y en el `.env`.

### 4.5 Cómo configurar el flujo en Power Automate

1. **Trigger:** "When an item is created" sobre la lista de SharePoint de solicitudes de compra.
2. **Acción HTTP:** POST al webhook con el JSON del ítem.
3. **Campos a mapear** desde SharePoint al JSON:

| Campo SharePoint | Campo JSON |
|---|---|
| Consecutivo OS | `consecutivo_os` |
| Título / Descripción | `descripcion` |
| Cantidad | `cantidad` |
| Prioridad | `nivel_prioridad` (Alta / Media / Baja) |
| Nombre solicitante | `solicitante_nombre` |
| Email solicitante | `solicitante_email` |
| Categoría | `categoria` |
| Grupo artículos | `grupo_articulos` |
| Área | `area` |
| Sede | `sede` |
| Cliente | `cliente` |
| Condición | `condicion` |
| Observaciones | `observaciones_solicitante` |
| Placa / Ficha técnica | `placa_ficha` |
| Fecha próximo mantenimiento | `fecha_proximo_mantenimiento` (formato `YYYY-MM-DD`) |

---

## 5. Endpoints REST completos

### Webhook (sin autenticación JWT)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/oc/webhook/nueva-solicitud` | PA crea nueva solicitud |

### Solicitudes (requiere JWT)
| Método | Ruta | Guard | Descripción |
|---|---|---|---|
| GET | `/api/oc/solicitudes` | require_compras | Lista con filtros `estado`, `sede`, paginación |
| GET | `/api/oc/solicitudes/{id}` | require_compras | Detalle completo |
| PATCH | `/api/oc/solicitudes/{id}/asignar` | require_compras | Asigna auxiliar, avanza a `en_cotizacion` |
| PATCH | `/api/oc/solicitudes/{id}/estado` | require_compras | Cambio manual de estado |

### Cotizaciones (requiere JWT)
| Método | Ruta | Guard | Descripción |
|---|---|---|---|
| POST | `/api/oc/solicitudes/{id}/cotizacion` | require_compras | Carga cotización, avanza a `pendiente_aprobacion` |
| GET | `/api/oc/solicitudes/{id}/cotizaciones` | require_compras | Lista cotizaciones de la solicitud |
| PATCH | `/api/oc/cotizaciones/{id}/aprobar` | directivo/admin | Aprueba cotización, avanza a `aprobada` |
| PATCH | `/api/oc/cotizaciones/{id}/rechazar` | directivo/admin | Rechaza, regresa a `en_cotizacion` |

### Documentos / Orden de Compra (requiere JWT)
| Método | Ruta | Guard | Descripción |
|---|---|---|---|
| POST | `/api/oc/solicitudes/{id}/generar-oc` | require_compras | Genera DOCX + intenta PDF con LibreOffice |
| GET | `/api/oc/solicitudes/{id}/orden` | autenticado | Obtiene la OC de esa solicitud |
| GET | `/api/oc/ordenes/{id}/descargar` | autenticado | Descarga PDF o DOCX |

### KPIs (requiere JWT)
| Método | Ruta | Guard | Descripción |
|---|---|---|---|
| GET | `/api/oc/kpis` | require_compras | 10 métricas agregadas del módulo |

### Proveedores (requiere JWT)
| Método | Ruta | Guard | Descripción |
|---|---|---|---|
| GET | `/api/oc/proveedores` | require_compras | Lista (filtro `solo_activos`) |
| POST | `/api/oc/proveedores` | require_compras | Crear proveedor |
| PUT | `/api/oc/proveedores/{id}` | require_compras | Actualizar proveedor |

---

## 6. Páginas del frontend

| Ruta | Componente | Visible para | Descripción |
|---|---|---|---|
| `/oc/solicitudes` | `SolicitudesPage` | Admin, Directivo, Compras | Tabla con filtros estado/sede, polling 30s |
| `/oc/solicitudes/:id` | `SolicitudDetallePage` | Admin, Directivo, Compras | Detalle, asignar auxiliar, ver cotizaciones, aprobar/rechazar, generar/descargar OC |
| `/oc/solicitudes/:id/cotizar` | `CotizacionFormPage` | Admin, Compras | Formulario para cargar cotización de proveedor |
| `/oc/aprobacion` | `AprobacionPage` | Admin, Directivo | Panel con solicitudes `pendiente_aprobacion`, badge de cantidad en sidebar |
| `/oc/kpis` | `KPIPage` | Admin, Directivo, Compras | Dashboard con 10 KPIs en tiempo real, polling 60s |

---

## 7. Generación del documento OC

Cuando una solicitud está en estado `aprobada`, el auxiliar de Compras puede generar el documento oficial:

1. `POST /api/oc/solicitudes/{id}/generar-oc`
2. El backend busca la cotización aprobada más reciente.
3. Genera número secuencial: `OC-{año}-{0001}` (incrementa automáticamente).
4. Crea el DOCX con `python-docx`:
   - Membrete ZYMO en azul `#003087`
   - Número OC y fecha de emisión
   - Sección Proveedor (nombre, email)
   - Sección Ítem solicitado (consecutivo, descripción, cantidad, categoría, sede, cliente)
   - Tabla de valores (valor unitario y total en COP)
   - Sección de aprobación (valor aprobado, observaciones)
5. Intenta convertir a PDF con LibreOffice (`libreoffice --headless --convert-to pdf`).
   - Si LibreOffice no está disponible → solo DOCX, sin error.
6. Guarda en `/app/data/oc_docs/{numero_oc}.docx` (y `.pdf` si aplica).
7. Crea registro `OrdenCompra` en `oc.db`.

Los archivos persisten en el volumen Docker `backend_data` → seguro ante reinicios y rebuilds.

---

## 8. Variables de entorno relevantes

```env
# oc.db — base de datos separada de la intranet
OC_DATABASE_URL=sqlite:///./data/oc.db

# Secret compartido entre PA y el backend para validar el webhook
# Vacío = sin validación (solo desarrollo)
# En producción: generar con `openssl rand -hex 32`
OC_WEBHOOK_SECRET=

# CORS — incluir el dominio de la intranet
CORS_ORIGINS=http://localhost:5173,https://zymointranet.com
```

---

## 9. Flujo completo paso a paso

```
1. SOLICITUD NUEVA
   SharePoint/Forms ──[trigger]──► Power Automate
   Power Automate   ──[POST]────► /api/oc/webhook/nueva-solicitud
   Backend          ──[crea]────► SolicitudOC (estado: "nueva") en oc.db
   Intranet         ──[polling]─► SolicitudesPage detecta la nueva solicitud en 30s

2. ASIGNACIÓN
   Auxiliar Compras abre la solicitud en /oc/solicitudes/{id}
   Hace clic en "Asignarme esta solicitud"
   Backend: PATCH /asignar → estado pasa a "en_cotizacion"

3. COTIZACIÓN
   Auxiliar abre /oc/solicitudes/{id}/cotizar
   Selecciona proveedor del catálogo o ingresa manualmente
   Completa: valor unitario, valor total, número cotización, vigencia, observaciones
   Backend: POST /cotizacion → estado pasa a "pendiente_aprobacion"
   Sidebar del directivo muestra badge con el número de pendientes

4. APROBACIÓN
   Directivo ve badge naranja en "Aprobaciones" del sidebar
   Abre /oc/aprobacion → lista de solicitudes pendientes
   Hace clic en "Revisar" → va al detalle
   Panel de aprobación muestra resumen de la cotización
   Directivo puede:
     a) Aprobar: ajusta valor si necesario + observaciones → estado "aprobada"
     b) Rechazar: motivo obligatorio → estado "rechazada" → auxiliar carga nueva cotización

5. GENERACIÓN OC
   Auxiliar ve panel "Generar Orden de Compra" en el detalle (solo si estado="aprobada")
   Hace clic en "Generar OC"
   Backend genera DOCX (+ PDF si LibreOffice disponible)
   Número de OC asignado: OC-2025-0001, OC-2025-0002, etc.
   Botón cambia a "Descargar PDF/DOCX"
   Auxiliar descarga el documento y lo envía al proveedor

6. SEGUIMIENTO
   Estado avanza manualmente: oc_enviada → entregada → cerrada
   KPI dashboard en /oc/kpis refleja todo en tiempo real (polling 60s)
```

---

## 10. Estructura de archivos del módulo

```
backend/
  app/
    models/
      oc.py                    # SolicitudOC, CotizacionProveedor, OrdenCompra, Proveedor
    routers/
      oc/
        __init__.py
        router.py              # APIRouter principal /api/oc
        webhook.py             # POST /webhook/nueva-solicitud
        solicitudes.py         # CRUD solicitudes
        cotizaciones.py        # CRUD cotizaciones + aprobar/rechazar
        documentos.py          # Generación DOCX/PDF
        kpis.py                # Dashboard de métricas
        proveedores.py         # Catálogo de proveedores
    oc_database.py             # Engine y sesión de oc.db
    config.py                  # OC_DATABASE_URL, OC_WEBHOOK_SECRET

frontend/
  src/
    types/
      oc.ts                    # EstadoOC, SolicitudOC, CotizacionProveedor,
                               # OrdenCompra, Proveedor, KPIData, ConteoItem
    hooks/
      useOC.ts                 # useSolicitudes, useSolicitud, useAsignarAuxiliar,
                               # useCambiarEstado, useCotizaciones, useCrearCotizacion,
                               # useAprobarCotizacion, useRechazarCotizacion,
                               # useOrden, useGenerarOC, useKPIs, useProveedores
    pages/
      oc/
        SolicitudesPage.tsx    # Lista con filtros + polling
        SolicitudDetallePage.tsx  # Detalle completo
        CotizacionFormPage.tsx    # Formulario cotización
        AprobacionPage.tsx        # Panel directivo
        KPIPage.tsx               # Dashboard KPIs
    components/
      layout/
        Sidebar.tsx            # Sección OC con badge de aprobaciones pendientes
```

---

## 11. Datos de prueba — Ejemplo webhook con curl

```bash
# Simular llamada de Power Automate (sin secret configurado en dev)
curl -X POST https://[dominio]/api/oc/webhook/nueva-solicitud \
  -H "Content-Type: application/json" \
  -d '{
    "consecutivo_os": "OS-2025-001",
    "descripcion": "Tóner HP LaserJet Pro M404dn negro",
    "cantidad": 2,
    "nivel_prioridad": "Alta",
    "solicitante_nombre": "María García",
    "solicitante_email": "m.garcia@zymo.com",
    "categoria": "Consumibles",
    "grupo_articulos": "Papelería e insumos",
    "area": "Operaciones",
    "sede": "Bogotá",
    "cliente": "Interno"
  }'

# Respuesta esperada:
# {"ok": true, "solicitud_id": "...", "consecutivo_os": "OS-2025-001"}
```

### Como funciona actualmente el webhook?

Campo que envía PA          →  Campo en SolicitudOC (oc.db)
─────────────────────────────────────────────────────────────
consecutivo_os              →  consecutivo_os      (deduplicación)
descripcion                 →  descripcion
cantidad                    →  cantidad
nivel_prioridad             →  nivel_prioridad     (Alta/Media/Baja)
solicitante_nombre          →  solicitante_nombre
solicitante_email           →  solicitante_email
categoria                   →  categoria
grupo_articulos             →  grupo_articulos
area              ← ojo!   →  area_solicitante    (mapeo de nombre)
sede                        →  sede
cliente                     →  cliente
condicion                   →  condicion
observaciones_solicitante   →  observaciones_solicitante
placa_ficha                 →  placa_ficha
fecha_proximo_mantenimiento →  fecha_proximo_mantenimiento
                            →  estado = "nueva"    (lo pone el backend)
                            →  fecha_solicitud = now() (lo pone el backend)

---

*Documento generado: 2026-04-09 · Módulo completado en Fases 1–7*
