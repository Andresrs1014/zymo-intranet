# ZYMO Intranet — Estado del Proyecto

**Última actualización:** 2026-04-14
**Branch activo:** `master`
**Repositorio:** `Andresrs1014/zymo-intranet`

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + SQLModel + SQLite + python-jose HS256 |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS + TanStack Query + Zustand + Axios |
| Email | fastapi-mail 1.4.2 + Office 365 SMTP |
| Documentos | python-docx + LibreOffice (conversión a PDF) |
| Deploy | Docker Compose + Nginx |
| Puertos | backend=8001, frontend=81 |

---

## Módulos del proyecto

### 1. Autenticación ✅

- Login con JWT (HS256, expira en 8 horas)
- Roles: `admin`, `directivo`, `administrativo`, `talento_cultura`, `comercial`, `operativo`, `empleado`, `compras`
- Tabla `User`: id, email, full_name, hashed_password, role, sede, area, is_active
- Endpoint: `POST /api/auth/login`

---

### 2. Dashboard / Portal ✅

- `DashboardPage`: tarjetas de apps según rol del usuario
- Apps integradas (abren en nueva pestaña):

| App | URL |
|-----|-----|
| Matriz | matriz.zymointranet.com |
| CRM Tarifas | crm.zymointranet.com |
| OC Automatizaciones | intranet + módulo interno |
| Portal Capacitaciones | capacitaciones.zymointranet.com |

---

### 3. Módulo OC Automatizaciones ✅ (flujo completo implementado)

#### Flujo completo de una solicitud

```
MS Forms → Power Automate → POST /api/oc/webhook/nueva-solicitud
                                        ↓
                              SolicitudOC creada en oc.db
                              Estado: nueva  |  Prioridad: Media (ajustable)
                                        ↓
                         Auxiliar de compras la toma en la intranet
                              Estado: en_cotizacion
                         [Email Flujo 1 → solicitante]
                                        ↓
                         Auxiliar carga cotizaciones de proveedores
                         (con archivo adjunto PDF/Excel/Word)
                              Estado: pendiente_aprobacion
                         [Email Flujo 2 → solicitante]
                         [Email Flujo 3 → directora/aprobadora]
                                        ↓
                         Directora / Administrativo aprueba cotización
                              Estado: aprobada
                                        ↓
                         Auxiliar genera el documento OC (DOCX/PDF)
                         Auxiliar confirma email proveedor → envía OC como adjunto
                              Estado: oc_enviada
                         [Email OC → proveedor (adjunto DOCX/PDF)]
                         [Email Flujo 4 → solicitante]
                                        ↓
                         Auxiliar marca como entregada (proveedor entregó)
                              Estado: entregada
                                        ↓
                         Auxiliar cierra la solicitud
                              Estado: cerrada
```

**Estado con rechazo:**
```
pendiente_aprobacion → rechazada  (directora o administrativo rechaza)
```

---

#### Backend — Archivos del módulo OC

| Archivo | Descripción |
|---------|-------------|
| `app/models/oc.py` | Modelos SQLModel: `SolicitudOC`, `CotizacionProveedor`, `OrdenCompra`, `Proveedor`, `OcConfig` |
| `app/routers/oc/webhook.py` | `POST /api/oc/webhook/nueva-solicitud` — sin auth, recibe desde Power Automate |
| `app/routers/oc/solicitudes.py` | CRUD de solicitudes, asignación de auxiliar, cambio de estado, prioridad, gestión de campos |
| `app/routers/oc/cotizaciones.py` | Crear, aprobar y rechazar cotizaciones de proveedores |
| `app/routers/oc/documentos.py` | Generar OC (DOCX/PDF), descargar, marcar enviada/entregada/cerrada, enviar al proveedor |
| `app/routers/oc/kpis.py` | KPIs: totales, por estado, por plataforma, solicitudes recientes |
| `app/routers/oc/config.py` | CRUD de `OcConfig` (SMTP, emails, templates) desde la UI |
| `app/routers/oc/proveedores.py` | Listado de proveedores |
| `app/services/email_service.py` | Flujos de email 1–4 + envío OC a proveedor con adjunto |

#### Endpoints OC completos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/oc/webhook/nueva-solicitud` | Recibe solicitud desde Power Automate |
| GET | `/api/oc/solicitudes` | Lista todas (filtros: estado, plataforma) |
| GET | `/api/oc/solicitudes/{id}` | Detalle de una solicitud |
| PATCH | `/api/oc/solicitudes/{id}/asignar` | Asigna auxiliar de compras |
| PATCH | `/api/oc/solicitudes/{id}/estado` | Cambia estado manualmente |
| PATCH | `/api/oc/solicitudes/{id}/prioridad` | Cambia prioridad (compras, admin, directivo, administrativo) |
| PATCH | `/api/oc/solicitudes/{id}/gestionar` | Actualiza campos de gestión (remisión, factura, etc.) |
| GET | `/api/oc/solicitudes/{id}/cotizaciones` | Lista cotizaciones de una solicitud |
| POST | `/api/oc/solicitudes/{id}/cotizacion` | Agrega cotización de proveedor |
| PATCH | `/api/oc/cotizaciones/{id}/aprobar` | Aprueba cotización (admin, directivo, administrativo) |
| PATCH | `/api/oc/cotizaciones/{id}/rechazar` | Rechaza cotización (admin, directivo, administrativo) |
| POST | `/api/oc/solicitudes/{id}/generar-oc` | Genera documento OC (DOCX + intento PDF) con formato LOGIMAT |
| GET | `/api/oc/solicitudes/{id}/orden` | Retorna registro de la OC |
| GET | `/api/oc/ordenes/{id}/descargar` | Descarga el archivo PDF o DOCX |
| POST | `/api/oc/solicitudes/{id}/marcar-enviada` | Avanza a `oc_enviada`, envía OC al proveedor como adjunto + Flujo 4 |
| POST | `/api/oc/solicitudes/{id}/marcar-entregada` | Avanza a `entregada` |
| POST | `/api/oc/solicitudes/{id}/cerrar` | Avanza a `cerrada` |
| GET | `/api/oc/kpis` | KPIs del módulo |
| GET | `/api/oc/proveedores` | Lista proveedores |
| GET | `/api/oc/config` | Lee configuración OC |
| PATCH | `/api/oc/config` | Guarda configuración OC |

---

#### Frontend — Páginas del módulo OC

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `SolicitudesPage.tsx` | `/oc/solicitudes` | Tabla de todas las solicitudes con filtros |
| `SolicitudDetallePage.tsx` | `/oc/solicitudes/:id` | Detalle completo: info, cotizaciones, OC, gestión |
| `CotizacionFormPage.tsx` | `/oc/solicitudes/:id/cotizacion` | Formulario para agregar cotización |
| `AprobacionPage.tsx` | `/oc/aprobacion` | Vista de aprobador (directivo, administrativo) |
| `KPIPage.tsx` | `/oc/kpis` | Dashboard de KPIs |
| `OcConfigPage.tsx` | `/oc/configuracion` | Configuración SMTP y emails (solo admin) |

#### Componentes principales en `SolicitudDetallePage`

| Componente | Función |
|-----------|---------|
| `PanelGestion` | Sidebar con 8 campos de gestión (remisión, factura, fechas, etc.) |
| `PanelOrdenCompra` | Panel de OC, cambia de botón según estado actual |
| `EstadoBadge` | Badge de color por estado |

#### `PanelOrdenCompra` — Comportamiento por estado

| Estado | UI mostrada |
|--------|------------|
| `aprobada` (sin OC) | Botón azul "Generar OC" |
| `aprobada` (con OC) | Botón "Enviar OC al proveedor" → modal con email pre-cargado del proveedor |
| `oc_enviada` | Botón azul "Marcar como entregada" |
| `entregada` | Botón teal "Cerrar solicitud" |
| `cerrada` | Panel gris informativo con botón de descarga |

---

#### Permisos por rol — Módulo OC

| Acción | admin | directivo | administrativo | compras |
|--------|-------|-----------|----------------|---------|
| Ver solicitudes | ✅ | ✅ | ✅ | ✅ |
| Asignarse solicitud | ✅ | ✅ | ✅ | ✅ |
| Cambiar prioridad | ✅ | ✅ | ✅ | ✅ |
| Cargar cotización | ✅ | ✅ | ✅ | ✅ |
| **Aprobar/rechazar cotización** | ✅ | ✅ | ✅ | ✗ |
| Generar OC | ✅ | ✅ | ✅ | ✅ |
| Enviar OC al proveedor | ✅ | ✅ | ✅ | ✅ |
| Configuración SMTP | ✅ | ✗ | ✗ | ✗ |

---

#### Notificaciones por Email

| Flujo | Evento | Destinatario |
|-------|--------|-------------|
| Flujo 1 | Auxiliar toma la solicitud (`en_cotizacion`) | Solicitante |
| Flujo 2 | Cotización cargada (`pendiente_aprobacion`) | Solicitante |
| Flujo 3 | Cotización lista para aprobar | Directora/Aprobadora (configurable desde UI) |
| Flujo 4 | OC enviada al proveedor (`oc_enviada`) | Solicitante |
| Flujo OC | Al marcar OC enviada | Proveedor (adjunto DOCX/PDF) |
| Flujo 5 | _(pendiente)_ Producto entregado | Solicitante |

La configuración SMTP se gestiona desde la UI en `/oc/configuracion`.
Si no hay config en DB, usa fallback al `.env`.

---

#### Modelo de datos OC

```
SolicitudOC
├── id (UUID)
├── consecutivo_os (OS-YYYY-XXXX, auto-generado)
├── estado (nueva|en_cotizacion|pendiente_aprobacion|aprobada|oc_enviada|entregada|cerrada|rechazada)
├── nivel_prioridad (Alta|Media|Baja — editable por compras/directivo/admin)
├── solicitante_nombre, solicitante_email, area_solicitante
├── categoria, grupo_articulos, descripcion, cantidad
├── plataforma, cliente, sede
├── condicion, observaciones_solicitante, placa_ficha
├── fecha_proximo_mantenimiento, evidencia_url
├── auxiliar_id (FK → intranet.db users)
├── numero_remision, numero_factura, aval_compra
├── fecha_estimada_entrega, fecha_confirmada_entrega
├── fecha_recibida_factura, fecha_envio_oc, fecha_recibido
├── observaciones_compras, observacion_contabilidad
└── created_at, updated_at, fecha_solicitud

CotizacionProveedor
├── id (UUID)
├── solicitud_id (FK → SolicitudOC)
├── proveedor_nombre, proveedor_nit, proveedor_email
├── numero_cotizacion_proveedor
├── valor_unitario, valor_antes_iva, valor_iva, valor_total
├── valor_aprobado
├── forma_pago, plazo_entrega
├── fecha_vigencia, observaciones
├── pdf_path (archivo adjunto subido por auxiliar)
├── extraccion_automatica (bool — True si datos fueron extraídos del archivo)
├── aprobada (bool), observaciones_aprobacion
└── created_at

OrdenCompra
├── id (UUID)
├── solicitud_id (FK → SolicitudOC)
├── cotizacion_id (FK → CotizacionProveedor)
├── numero_oc (OC-YYYY-XXXX, auto-generado)
├── pdf_path (ruta local al archivo generado)
├── email_proveedor (guardado al momento de enviar)
├── enviada_proveedor, enviada_coordinador (bool)
└── created_at

OcConfig
├── key (string)
└── value (string)
```

---

#### Formato del documento OC — LOGIMAT

El documento DOCX generado sigue el formato del template oficial de LOGIMAT:
- **Encabezado**: Nombre empresa + NIT + dirección | N° OC + Fecha
- **SEÑORES**: proveedor nombre + NIT + referencia OS/COT
- **Tabla ítems**: ÍTEM, CANT., DESCRIPCIÓN, VALOR UNITARIO (encabezado rojo)
- **Totales**: SUB TOTAL + IVA (si aplica) + VALOR TOTAL
- **Condiciones**: buzón facturación + forma de pago + plazo de entrega
- **Firmas**: SOLICITA (solicitante) / ELABORA (auxiliar) / APRUEBA (directora) — nombres auto-poblados

Configuración por plataforma en `zymo/platforms/{slug}/config.json`.

---

#### JSON esperado del Webhook (Power Automate → Intranet)

```json
{
  "categoria": "...",
  "grupo_articulos": "...",
  "descripcion": "...",
  "cantidad": 1,
  "solicitante_nombre": "...",
  "solicitante_email": "...",
  "area_solicitante": "...",
  "plataforma": "Logimat",
  "cliente": "...",
  "condicion": "...",
  "observaciones_solicitante": "...",
  "placa_ficha": "...",
  "fecha_proximo_mantenimiento": "2026-05-01",
  "evidencia_url": "https://..."
}
```

Campos generados automáticamente en backend:
- `consecutivo_os` → `OS-YYYY-XXXX`
- `nivel_prioridad` → `"Media"` (ajustable desde la intranet)
- `estado` → inicia en `nueva`
- `created_at`, `updated_at`, `fecha_solicitud`

---

## Carpeta `zymo/`

Contiene assets y configuración de marca por plataforma:

```
zymo/
├── logo_zymo.svg                  ← Logo principal Zymo (rojo/blanco)
└── platforms/
    ├── logimat/config.json        ← NIT, dirección, email, prefijo OC ✅
    ├── imccargo/config.json       ← Pendiente completar datos
    └── imcdep/config.json         ← Pendiente completar datos
```

---

## Bases de Datos

| Archivo | Contenido |
|---------|-----------|
| `intranet.db` | Usuarios, roles, autenticación |
| `oc.db` | Solicitudes OC, cotizaciones, órdenes de compra, proveedores, configuración |

Ambas en el mismo container FastAPI. La resolución de nombre de auxiliar/aprobador cruza DBs vía consulta directa a `intranet.db`.

---

## Infraestructura

- **Docker Compose** con servicios: `backend`, `frontend`
- **Nginx** como reverse proxy: `/api/` → backend:8001, `/` → frontend:81
- **Bind mount** para persistencia de `oc.db` y archivos OC generados en `backend_data` volume

---

## Pendientes / Backlog

### Alta prioridad
- [ ] **Extracción automática de cotizaciones** — upload PDF/Excel/Word → extraer proveedor_nit, valores, IVA, forma_pago, plazo_entrega → preview con campos pre-llenados para confirmar antes de guardar
- [ ] **Flujo 5** — email al solicitante cuando el producto es entregado (`entregada`)
- [ ] **NIT y campos faltantes en formulario de cotización** — agregar campos nuevos al `CotizacionFormPage.tsx` (proveedor_nit, forma_pago, plazo_entrega, valor_antes_iva, valor_iva)

### Media prioridad
- [ ] **Prueba end-to-end del webhook** — enviar request de prueba desde Power Automate o curl
- [ ] **Dropdown para asignar auxiliar** — UI para elegir auxiliar (actualmente se asigna a sí mismo)
- [ ] **Dashboard de métricas** — gráficos de tendencias por mes en KPIPage
- [ ] **Módulo de proveedores** — CRUD completo (actualmente solo listado)
- [ ] **Formatos OC para IMCCARGO e IMC Depósito** — completar `config.json` con NIT y dirección

### Baja prioridad / Fase 2
- [ ] **SharePoint List push** — al cerrar la solicitud, escribir en SharePoint para trazabilidad
- [ ] **OCR de cotizaciones escaneadas** — para cuando los proveedores envíen imágenes
- [ ] **Refresh tokens** — mejorar seguridad de sesión
- [ ] **PostgreSQL** — migrar de SQLite para entornos de mayor carga
- [ ] **Logo Zymo en documento OC** — integrar `logo_zymo.svg` como imagen en el encabezado del DOCX
- [ ] **Formato OC para plataforma Zymo** — pendiente para fase futura

---

## Commits recientes relevantes

```
7273580 Envio OC a proveedor
0886579 Envio de Email a proveedor
ea7e188 Minor fixes
9fc8585 Permisos para crear OC
40cc575 fix: resolver conflicto docker-compose depends_on
0d72436 Cambio en prioridades
b90e114 Minor Fixed
```
