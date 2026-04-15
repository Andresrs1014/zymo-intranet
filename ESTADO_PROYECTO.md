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
| Extracción | pdfplumber (PDF texto) + openpyxl (Excel) + python-docx (Word) |
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
                         [Email Flujo 1 → solicitante: consecutivo, descripción, fecha hora Colombia]
                                        ↓
                         Auxiliar sube cotización del proveedor (PDF/Excel/Word)
                         → Extracción automática de campos (NIT, valores, IVA, forma pago, plazo)
                         → Preview con campos pre-llenados → auxiliar confirma/corrige
                              Estado: pendiente_aprobacion
                         [Email Flujo 2 → solicitante: fechas en hora Colombia]
                         [Email Flujo 3 → directora: valor cotización, proveedor, NIT, IVA, fechas]
                                        ↓
                         Directora / Administrativo aprueba cotización
                              Estado: aprobada
                                        ↓
                         Auxiliar genera el documento OC (DOCX/PDF — formato LOGIMAT)
                         Auxiliar confirma email proveedor → envía OC como adjunto
                              Estado: oc_enviada
                         [Email OC → proveedor (adjunto DOCX/PDF, branding LOGIMAT)]
                         [Email Flujo 4 → solicitante: fecha envío en hora Colombia]
                                        ↓
                         Auxiliar marca como entregada (proveedor entregó)
                              Estado: entregada
                                        ↓
                         Auxiliar cierra la solicitud
                              Estado: cerrada
```

**Estado con rechazo:**
```
pendiente_aprobacion → rechazada → en_cotizacion  (directora rechaza, auxiliar busca nueva cotización)
```

---

#### Backend — Archivos del módulo OC

| Archivo | Descripción |
|---------|-------------|
| `app/models/oc.py` | Modelos SQLModel: `SolicitudOC`, `CotizacionProveedor`, `OrdenCompra`, `Proveedor`, `OcConfig` |
| `app/routers/oc/webhook.py` | `POST /api/oc/webhook/nueva-solicitud` — sin auth, recibe desde Power Automate |
| `app/routers/oc/solicitudes.py` | CRUD de solicitudes, asignación de auxiliar, cambio de estado, prioridad, gestión de campos |
| `app/routers/oc/cotizaciones.py` | Crear, aprobar/rechazar cotizaciones + endpoint de extracción automática desde archivos |
| `app/routers/oc/documentos.py` | Generar OC (DOCX/PDF), descargar, marcar enviada/entregada/cerrada, enviar al proveedor |
| `app/routers/oc/kpis.py` | KPIs: totales, por estado, por plataforma, solicitudes recientes |
| `app/routers/oc/config.py` | CRUD de `OcConfig` (SMTP, emails) desde la UI |
| `app/routers/oc/proveedores.py` | Listado de proveedores |
| `app/services/email_service.py` | Flujos 1–4 + envío OC a proveedor. Branding LOGIMAT, fechas en hora Colombia |
| `app/platforms/logimat/config.json` | NIT, dirección, PBX, email facturación LOGIMAT ✅ |
| `app/static/logimat_logo.png` | Logo real de LOGIMAT embebido en el documento DOCX |

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
| POST | `/api/oc/solicitudes/{id}/cotizacion/extraer` | Extrae campos de PDF/Excel/Word sin guardar — devuelve preview |
| POST | `/api/oc/solicitudes/{id}/cotizacion` | Guarda cotización con todos los campos (incluyendo extraídos) |
| PATCH | `/api/oc/cotizaciones/{id}/aprobar` | Aprueba cotización (admin, directivo, administrativo) |
| PATCH | `/api/oc/cotizaciones/{id}/rechazar` | Rechaza cotización (admin, directivo, administrativo) |
| POST | `/api/oc/solicitudes/{id}/generar-oc` | Genera documento OC (DOCX + intento PDF) con formato y logo LOGIMAT |
| GET | `/api/oc/solicitudes/{id}/orden` | Retorna registro de la OC |
| GET | `/api/oc/ordenes/{id}/descargar` | Descarga el archivo PDF o DOCX |
| POST | `/api/oc/solicitudes/{id}/marcar-enviada` | Avanza a `oc_enviada`, envía OC al proveedor como adjunto |
| POST | `/api/oc/solicitudes/{id}/marcar-entregada` | Avanza a `entregada` |
| POST | `/api/oc/solicitudes/{id}/cerrar` | Avanza a `cerrada` |
| GET | `/api/oc/kpis` | KPIs del módulo |
| GET | `/api/oc/proveedores` | Lista proveedores |
| GET/PATCH | `/api/oc/config` | Lee/guarda configuración OC (SMTP, emails) |

---

#### Frontend — Páginas del módulo OC

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `SolicitudesPage.tsx` | `/oc/solicitudes` | Tabla de todas las solicitudes con filtros |
| `SolicitudDetallePage.tsx` | `/oc/solicitudes/:id` | Detalle completo: info, cotizaciones, OC, gestión |
| `CotizacionFormPage.tsx` | `/oc/solicitudes/:id/cotizacion` | Formulario con zona de carga, extracción automática y campos completos |
| `AprobacionPage.tsx` | `/oc/aprobacion` | Vista de aprobador (directivo, administrativo) |
| `KPIPage.tsx` | `/oc/kpis` | Dashboard de KPIs |
| `OcConfigPage.tsx` | `/oc/configuracion` | Configuración SMTP y emails (solo admin) |

#### Utilidades frontend

| Archivo | Descripción |
|---------|-------------|
| `src/lib/dates.ts` | `formatFechaHora`, `formatFecha`, `formatFechaRelativa` — todas muestran en hora Colombia (America/Bogota). Fuerzan interpretación UTC aunque SQLite no incluya el sufijo Z |
| `src/hooks/useOC.ts` | Todos los hooks del módulo OC incluyendo `useExtraerCotizacion` |

---

#### Permisos por rol — Módulo OC

| Acción | admin | directivo | administrativo | compras |
|--------|-------|-----------|----------------|---------|
| Ver solicitudes | ✅ | ✅ | ✅ | ✅ |
| Asignarse solicitud | ✅ | ✅ | ✅ | ✅ |
| Cambiar prioridad | ✅ | ✅ | ✅ | ✅ |
| Cargar cotización | ✅ | ✅ | ✅ | ✅ |
| Aprobar/rechazar cotización | ✅ | ✅ | ✅ | ✗ |
| Generar OC | ✅ | ✅ | ✅ | ✅ |
| Enviar OC al proveedor | ✅ | ✅ | ✅ | ✅ |
| Configuración SMTP | ✅ | ✗ | ✗ | ✗ |

---

#### Notificaciones por Email — Estado actual

| Flujo | Evento | Destinatario | Contenido |
|-------|--------|-------------|-----------|
| Flujo 1 | Auxiliar toma solicitud (`en_cotizacion`) | Solicitante | Consecutivo, descripción, cantidad, prioridad, fecha solicitud (hora COL) |
| Flujo 2 | Cotización cargada (`pendiente_aprobacion`) | Solicitante | Consecutivo, descripción, fecha solicitud y cotización (hora COL) |
| Flujo 3 | Cotización lista para aprobar | Directora/Aprobadora | **Valor total, subtotal, IVA, proveedor, NIT, forma pago, plazo entrega**, fechas (hora COL) |
| Flujo 4 | OC enviada al proveedor (`oc_enviada`) | Solicitante | Consecutivo, fecha envío, fecha estimada entrega (hora COL) |
| Flujo OC | Al marcar OC enviada | Proveedor | Adjunto DOCX/PDF, datos de la orden, branding LOGIMAT |
| Flujo 5 | _(pendiente)_ Producto entregado | Solicitante | — |

Todos los correos usan branding LOGIMAT (header rojo #C8102E, footer con NIT y PBX).
La configuración SMTP se gestiona desde `/oc/configuracion`. Fallback a `.env`.

---

#### Formato del documento OC — LOGIMAT

- **Logo real** de LOGIMAT (3cm) en encabezado izquierdo
- **Caja roja** con número OC y fecha (hora Colombia) en encabezado derecho
- **SEÑORES**: proveedor nombre + NIT + referencia OS/COT
- **Tabla ítems**: ÍTEM, CANT., DESCRIPCIÓN, VALOR UNITARIO (encabezado rojo)
- **Totales**: SUB TOTAL + IVA (si aplica) + VALOR TOTAL (fondo rojo)
- **Condiciones**: buzón facturación + forma de pago + plazo de entrega
- **Firmas**: SOLICITA / ELABORA / APRUEBA con nombres auto-poblados desde intranet.db
- **Pie**: NIT, ciudad, PBX de LOGIMAT

Configuración por plataforma en `backend/app/platforms/{slug}/config.json` (dentro del build Docker).

---

#### Extracción automática de cotizaciones

El endpoint `POST /cotizacion/extraer` acepta PDF (texto plano), Excel (.xlsx) o Word (.docx) del proveedor y extrae mediante regex:

| Campo | Patrón buscado |
|-------|---------------|
| NIT | `NIT:`, `N.I.T.` seguido de número con formato colombiano |
| Valor total | `TOTAL A PAGAR`, `VALOR TOTAL`, `GRAN TOTAL` |
| Subtotal | `SUBTOTAL`, `VALOR ANTES DE IVA`, `BASE GRAVABLE` |
| IVA | `IVA 19%`, `IVA` |
| Valor unitario | `VALOR UNITARIO`, `PRECIO UNITARIO` |
| Forma de pago | `FORMA DE PAGO`, `CONDICIONES DE PAGO` |
| Plazo de entrega | `PLAZO DE ENTREGA`, `TIEMPO DE ENTREGA` |

El resultado muestra cuántos campos se encontraron (verde ≥3, amarillo <3) y pre-llena el formulario. El auxiliar revisa y corrige antes de guardar.

**Limitación conocida:** Solo funciona con PDFs de texto (no escaneados/imágenes). OCR para escaneados es backlog.

---

#### Zona horaria

**Problema resuelto:** SQLite devuelve datetimes sin sufijo `Z`. JS los interpretaba como hora local en vez de UTC → 5 horas de diferencia.

**Solución:** `frontend/src/lib/dates.ts` detecta si falta el `Z` y lo agrega antes de parsear, luego formatea con `timeZone: "America/Bogota"` explícito. El documento DOCX usa `ZoneInfo("America/Bogota")` en Python.

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

Campos generados automáticamente: `consecutivo_os` → `OS-YYYY-XXXX`, `nivel_prioridad` → `"Media"`, `estado` → `nueva`, timestamps.

---

#### Modelo de datos OC

```
SolicitudOC
├── id (UUID)
├── consecutivo_os
├── estado (nueva|en_cotizacion|pendiente_aprobacion|aprobada|oc_enviada|entregada|cerrada|rechazada)
├── nivel_prioridad (Alta|Media|Baja — editable)
├── solicitante_nombre, solicitante_email, area_solicitante
├── categoria, grupo_articulos, descripcion, cantidad
├── plataforma, cliente, sede, condicion
├── observaciones_solicitante, placa_ficha, fecha_proximo_mantenimiento, evidencia_url
├── auxiliar_id (FK lógica → intranet.db users)
├── numero_remision, numero_factura, aval_compra
├── observaciones_compras, observacion_contabilidad
├── fecha_estimada_entrega, fecha_confirmada_entrega, fecha_recibida_factura
└── fecha_solicitud, fecha_asignacion, fecha_cotizacion, fecha_aprobacion, fecha_envio_oc, fecha_recibido

CotizacionProveedor
├── id (UUID)
├── solicitud_id
├── proveedor_nombre, proveedor_nit, proveedor_email
├── numero_cotizacion_proveedor
├── valor_unitario, valor_antes_iva, valor_iva, valor_total, valor_aprobado
├── forma_pago, plazo_entrega
├── fecha_vigencia, observaciones
├── pdf_path, extraccion_automatica (bool)
├── aprobada (bool), aprobado_por_id, observaciones_aprobacion
└── created_at

OrdenCompra
├── id (UUID)
├── solicitud_id, cotizacion_id
├── numero_oc (OC-YYYY-XXXX)
├── pdf_path, email_proveedor
├── enviada_proveedor, enviada_coordinador (bool)
└── created_at
```

---

## Bases de Datos

| Archivo | Contenido |
|---------|-----------|
| `intranet.db` | Usuarios, roles, autenticación |
| `oc.db` | Solicitudes OC, cotizaciones, órdenes de compra, proveedores, configuración SMTP |

Resolución de nombres (auxiliar/aprobador) cruza DBs vía consulta directa a `intranet.db` desde `documentos.py`.

---

## Infraestructura

- **Docker Compose** con servicios: `backend`, `frontend`
- **Nginx** como reverse proxy: `/api/` → backend:8001, `/` → frontend:81
- **Volume** `backend_data` para persistencia de `oc.db` y archivos OC generados
- **Build context** del backend es `./backend` — los assets (logo, configs de plataforma) deben estar dentro de `backend/app/`

---

## Pendientes / Backlog

### Alta prioridad — Fase 1 (completar primer paso)

- [ ] **Flujo 5** — email al solicitante cuando el producto es entregado (estado `entregada`). Falta `send_entregada()` en `email_service.py` y llamarla desde `marcar_entregada` en `documentos.py`
- [ ] **Prueba end-to-end del webhook** — enviar request real desde Power Automate con datos de formulario y verificar creación de solicitud + email Flujo 1
- [ ] **Dropdown para asignar auxiliar** — UI para que admin elija qué auxiliar asignar (actualmente cada auxiliar se asigna a sí mismo)
- [ ] **Entrenamiento del motor de extracción** — los regex funcionan pero necesitan calibración con más cotizaciones reales de los proveedores habituales de LOGIMAT

### Media prioridad

- [ ] **Dashboard de métricas** — gráficos de tendencias por mes en `KPIPage` (actualmente solo conteos)
- [ ] **Módulo de proveedores CRUD** — crear, editar, desactivar proveedores (actualmente solo listado de lectura)
- [ ] **Formatos OC para IMCCARGO e IMC Depósito** — completar `backend/app/platforms/imccargo/config.json` y `imcdep/config.json` con NIT, dirección, email de facturación y logo propios
- [ ] **Subir PDF de cotización y guardarlo** — actualmente el endpoint de extracción no guarda el archivo. Falta endpoint para guardar el PDF físicamente y asociarlo al `pdf_path` de la cotización

### Baja prioridad / Fase 2

- [ ] **SharePoint List push** — al cerrar la solicitud, escribir en SharePoint para trazabilidad histórica
- [ ] **OCR de cotizaciones escaneadas** — Google Vision o Tesseract para PDFs de imagen
- [ ] **Refresh tokens** — mejorar seguridad de sesión (actualmente JWT de 8h sin renovación)
- [ ] **PostgreSQL** — migrar de SQLite para entornos de mayor carga concurrente
- [ ] **Formato OC para plataforma Zymo** — pendiente para fase futura cuando se implemente
- [ ] **Notificación al auxiliar cuando directora rechaza cotización** — actualmente solo cambia el estado, no notifica por email
- [ ] **Historial de estados** — tabla de auditoría con todos los cambios de estado de una solicitud y quién los hizo

### Posibles mejoras identificadas

- **Cotización múltiple con comparación** — permitir cargar 2-3 cotizaciones de diferentes proveedores y mostrarlas en tabla comparativa para que la directora elija la mejor
- **Firma digital o visto bueno en la OC** — que la directora pueda "firmar" digitalmente desde la intranet antes de enviar al proveedor
- **Template de email configurable desde UI** — actualmente los mensajes están hardcodeados en `email_service.py`; podrían editarse desde `/oc/configuracion`
- **Reenvío de OC** — botón para reenviar la OC al proveedor si no confirmó, sin cambiar el estado
- **Integración con catálogo de proveedores** — cuando se carga una cotización y se detecta el NIT, auto-completar proveedor_nombre desde el catálogo
- **Recordatorio automático** — si una solicitud lleva X días en `pendiente_aprobacion` sin respuesta, re-enviar el Flujo 3 a la directora

---

## Commits recientes relevantes

```
[hoy] Emails rediseñados: branding LOGIMAT, valor cotización para directora, fechas hora Colombia
[hoy] Zona horaria Colombia en frontend (dates.ts) y documento DOCX
[hoy] Extracción automática de cotizaciones (PDF/Excel/Word) con preview
[hoy] Logo LOGIMAT real en documento OC, configs dentro de backend/ (fix Docker)
[hoy] Nuevos campos cotización: NIT, subtotal, IVA, forma pago, plazo entrega
[hoy] Documento OC rediseñado — formato compacto 1 página
2bb60d9 camvbios
64339dd correciones de estado de OC
```
