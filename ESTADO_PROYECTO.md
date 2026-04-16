# ZYMO Intranet — Estado del Proyecto

**Última actualización:** 2026-04-16
**Branch activo:** `master`
**Repositorio:** `Andresrs1014/zymo-intranet`

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + SQLModel + SQLite + python-jose HS256 |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS + TanStack Query + Zustand + Axios |
| Email | fastapi-mail 1.4.2 + Office 365 SMTP |
| Documentos | openpyxl (XLSX desde template) + LibreOffice headless (conversión a PDF) |
| Extracción | pdfplumber (PDF texto) + openpyxl (Excel) + python-docx (Word) + field_synonyms.py |
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
                         → Extracción automática de campos (NIT, valores, IVA, forma pago, plazo,
                           garantía, anticipo, pago saldo)
                         → Preview con campos pre-llenados → auxiliar confirma/corrige
                              Estado: cotizacion_lista
                         [Email Flujo 2 → solicitante: fechas en hora Colombia]
                         [Email Flujo 3 → directora: valor cotización, proveedor, NIT, IVA, fechas]
                                        ↓
                         Directora / Administrativo aprueba cotización
                              Estado: aprobada
                                        ↓
                         Auxiliar genera el documento OC (XLSX → PDF con LibreOffice)
                         Auxiliar confirma email proveedor → envía OC como adjunto
                              Estado: oc_enviada
                         [Email OC → proveedor (adjunto PDF, branding por plataforma)]
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
cotizacion_lista → rechazada → en_cotizacion  (directora rechaza, auxiliar busca nueva cotización)
```

---

#### Plataformas (empresas) ✅ — Todas configuradas

Cada empresa tiene su carpeta en `backend/app/platforms/{slug}/` con template propio:

| Slug | Empresa | Prefijo OC | Max items | Print area |
|------|---------|-----------|----------|------------|
| `logimat` | LOGIMAT S.A.S. | L | 20 | A1:J64 |
| `imccargo` | IMC CARGO INTERNATIONAL S.A.S. | C | 3 | A1:J45 |
| `imcdep` | IMC DEPOSITO S.A.S. | D | 1 | A1:J43 |

Cada plataforma contiene: `config.json`, `template.xlsx`, logo (`*.png` / `*.jpeg`).

⚠️ **LOGIMAT**: el archivo `logimat_logo.png` debe colocarse manualmente en `backend/app/platforms/logimat/logimat_logo.png` para que aparezca el logo en la OC.

---

#### Backend — Archivos del módulo OC

| Archivo | Descripción |
|---------|-------------|
| `app/models/oc.py` | Modelos SQLModel: `SolicitudOC`, `CotizacionProveedor`, `OrdenCompra`, `Proveedor`, `OcConfig` |
| `app/routers/oc/webhook.py` | `POST /api/oc/webhook/nueva-solicitud` — sin auth, recibe desde Power Automate |
| `app/routers/oc/solicitudes.py` | CRUD de solicitudes, asignación de auxiliar, cambio de estado, prioridad, gestión de campos |
| `app/routers/oc/cotizaciones.py` | Crear, aprobar/rechazar cotizaciones + extracción automática desde archivos |
| `app/routers/oc/documentos.py` | Generar OC (XLSX + PDF), descargar, marcar enviada/entregada/cerrada |
| `app/routers/oc/kpis.py` | KPIs: totales, por estado, por plataforma, solicitudes recientes |
| `app/routers/oc/config.py` | CRUD de `OcConfig` (SMTP, emails) desde la UI |
| `app/routers/oc/proveedores.py` | Listado de proveedores (activos desde sgc.db) |
| `app/services/email_service.py` | Flujos 1–4 + envío OC a proveedor. Branding LOGIMAT, fechas en hora Colombia |
| `app/services/field_synonyms.py` | Diccionario de sinónimos para normalizar campos extraídos. `resolve_field()` + `fuzzy_resolve()` |
| `app/platforms/{slug}/config.json` | Config por empresa: nombre, NIT, logo, celdas dinámicas, ítems |

#### `config.json` — estructura por plataforma

```json
{
  "nombre": "...",
  "nit": "...",
  "prefijo_oc": "L|C|D",
  "logo": "filename.png",
  "logo_anchor": "C3",
  "logo_width": 150,
  "logo_height": 55,
  "template": "template.xlsx",
  "print_area": "A1:J64",
  "celdas_dinamicas": {
    "numero_oc", "fecha", "proveedor_nombre", "proveedor_nit",
    "os_ref", "cot_ref", "solicita", "area_firma", "elabora", "aprueba",
    "nota", "forma_pago", "forma_pago_x", "anticipo", "pago_saldo",
    "plazo_inmediata_x", "plazo_dias", "plazo_fecha", "garantia"
  },
  "items": {
    "fila_inicio": 11,
    "max_filas": 20,
    "col_item_num": "C",
    "col_cantidad": "D",
    "col_referencia": "E",
    "col_descripcion": "F",
    "col_valor_unitario": "G"
  }
}
```

---

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
| POST | `/api/oc/solicitudes/{id}/cotizacion` | Guarda cotización con todos los campos |
| PATCH | `/api/oc/cotizaciones/{id}/aprobar` | Aprueba cotización (admin, directivo, administrativo) |
| PATCH | `/api/oc/cotizaciones/{id}/rechazar` | Rechaza cotización (admin, directivo, administrativo) |
| POST | `/api/oc/solicitudes/{id}/generar-oc` | Genera OC desde template XLSX + convierte a PDF con LibreOffice |
| GET | `/api/oc/solicitudes/{id}/orden` | Retorna registro de la OC |
| GET | `/api/oc/ordenes/{id}/descargar` | Descarga el archivo PDF (fallback XLSX) |
| POST | `/api/oc/solicitudes/{id}/marcar-enviada` | Avanza a `oc_enviada`, envía OC al proveedor como adjunto |
| POST | `/api/oc/solicitudes/{id}/marcar-entregada` | Avanza a `entregada` |
| POST | `/api/oc/solicitudes/{id}/cerrar` | Avanza a `cerrada` |
| GET | `/api/oc/kpis` | KPIs del módulo |
| GET | `/api/oc/proveedores` | Lista proveedores activos (desde sgc.db) |
| GET/PATCH | `/api/oc/config` | Lee/guarda configuración OC (SMTP, emails) |

---

#### Frontend — Páginas del módulo OC

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `SolicitudesPage.tsx` | `/oc/solicitudes` | Tabla de todas las solicitudes con filtros |
| `SolicitudDetallePage.tsx` | `/oc/solicitudes/:id` | Detalle completo: info, cotizaciones, OC, gestión |
| `CotizacionFormPage.tsx` | `/oc/solicitudes/:id/cotizacion` | Formulario con zona de carga, extracción automática y 10 campos completos |
| `AprobacionPage.tsx` | `/oc/aprobacion` | Vista de aprobador (directivo, administrativo) |
| `KPIPage.tsx` | `/oc/kpis` | Dashboard de KPIs |
| `OcConfigPage.tsx` | `/oc/configuracion` | Configuración SMTP y emails (solo admin) |

#### Utilidades frontend

| Archivo | Descripción |
|---------|-------------|
| `src/lib/dates.ts` | `formatFechaHora`, `formatFecha`, `formatFechaRelativa` — todas en hora Colombia (America/Bogota). Fuerzan interpretación UTC aunque SQLite no incluya el sufijo Z |
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
| Flujo 2 | Cotización cargada (`cotizacion_lista`) | Solicitante | Consecutivo, descripción, fecha solicitud y cotización (hora COL) |
| Flujo 3 | Cotización lista para aprobar | Directora/Aprobadora | Valor total, subtotal, IVA, proveedor, NIT, forma pago, plazo entrega, fechas (hora COL) |
| Flujo 4 | OC enviada al proveedor (`oc_enviada`) | Solicitante | Consecutivo, fecha envío, fecha estimada entrega (hora COL) |
| Flujo OC | Al marcar OC enviada | Proveedor | Adjunto PDF, datos de la orden, branding LOGIMAT |
| Flujo 5 | _(pendiente)_ Producto entregado | Solicitante | — |

Todos los correos usan branding LOGIMAT (header rojo #C8102E, footer con NIT y PBX).
La configuración SMTP se gestiona desde `/oc/configuracion`. Fallback a `.env`.

---

#### Generación del documento OC ✅

- Se genera un XLSX rellenando el `template.xlsx` de la plataforma con **openpyxl**
- LibreOffice headless convierte el XLSX a PDF (recalcula fórmulas del template)
- Fallback: si LibreOffice falla, se sirve el XLSX directamente

**Campos escritos al template por `_generar_xlsx()`:**

| Campo | Fuente |
|-------|--------|
| Número OC | Generado `OC-YYYY-XXXX` |
| Fecha | `datetime.now(America/Bogota)` |
| Proveedor nombre / NIT | `CotizacionProveedor` |
| OS ref / COT ref | `SolicitudOC.consecutivo_os` / `cotizacion.numero_cotizacion_proveedor` |
| Solicita / Área firma | `SolicitudOC.solicitante_nombre` / `area_solicitante` |
| Elabora / Aprueba | Nombres resueltos desde `intranet.db` |
| Nota | `cotizacion.observaciones` (fallback: `solicitud.observaciones_solicitante`) |
| Forma de pago + X | `cotizacion.forma_pago` |
| Plazo de entrega | Helper `_escribir_plazo_entrega`: INMEDIATA→X, número→días, texto→fecha |
| Garantía | `cotizacion.garantia` |
| Anticipo | `cotizacion.anticipo` |
| Pago saldo | `cotizacion.pago_saldo` |
| Ítem: N°, cantidad | `1`, `solicitud.cantidad` |
| Ítem: referencia | `solicitud.placa_ficha` → columna `col_referencia` del config |
| Ítem: descripción | `solicitud.descripcion` |
| Ítem: valor unitario | `cotizacion.valor_unitario` |
| IVA manual *(solo imcdep)* | `cotizacion.valor_iva` → celda `iva_manual` |
| Logo | Imagen local insertada con openpyxl (limpia `=IMAGE()` del template) |

---

#### Extracción automática de cotizaciones ✅

El endpoint `POST /cotizacion/extraer` acepta PDF (texto), Excel (.xlsx) o Word (.docx) y extrae:

| Campo canónico | Sinónimos reconocidos |
|---------------|----------------------|
| `proveedor_nombre` | proveedor, razón social, empresa, nombre... |
| `proveedor_nit` | nit, n.i.t., rut, id tributario... |
| `numero_cotizacion_proveedor` | n° cotización, ref. cotización, folio, propuesta... |
| `valor_unitario` | precio unitario, valor unit, costo unitario... |
| `valor_antes_iva` | subtotal, base gravable, valor sin IVA... |
| `valor_iva` | iva 19%, impuesto, tax, vat... |
| `valor_total` | total a pagar, gran total, valor con IVA... |
| `forma_pago` | forma de pago, condiciones de pago, crédito... |
| `plazo_entrega` | tiempo de entrega, lead time, días hábiles... |
| `garantia` | garantía, warranty, período de garantía... |
| `anticipo` | anticipo, down payment, pago inicial... |
| `pago_saldo` | saldo, contra entrega, balance payment... |
| `observaciones` | notas, comentarios, aclaraciones... |
| `fecha_vigencia` | válida hasta, vence, expiry date... |

Sinónimos gestionados en `app/services/field_synonyms.py` con índice invertido y matching fuzzy (`SequenceMatcher`, umbral 0.75).

**Bug corregido (2026-04-16):** `valor_total` y `valor_antes_iva` mostraban el mismo valor extraído.
- Causa 1: la lógica `find_money(...) or _extra.get("valor_antes_iva")` usaba el subtotal como fallback aunque fuera igual al total.
- Causa 2: `"precio base"` era sinónimo duplicado bajo `valor_unitario` y `valor_antes_iva` → última declaración ganaba, clasificando precios unitarios como subtotales.
- Fix: guard `_subtotal_extra != total` + eliminación del sinónimo duplicado.

El resultado pre-llena el formulario. El auxiliar revisa y corrige antes de guardar.

**Limitación conocida:** Solo funciona con PDFs de texto (no escaneados/imágenes). OCR para escaneados es backlog.

---

#### Zona horaria

**Problema resuelto:** SQLite devuelve datetimes sin sufijo `Z`. JS los interpretaba como hora local en vez de UTC → 5 horas de diferencia.

**Solución:** `frontend/src/lib/dates.ts` detecta si falta el `Z` y lo agrega antes de parsear, luego formatea con `timeZone: "America/Bogota"` explícito. El backend usa `ZoneInfo("America/Bogota")` en Python.

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
├── estado (nueva|en_cotizacion|cotizacion_lista|aprobada|oc_enviada|entregada|cerrada|rechazada)
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
├── garantia, anticipo, pago_saldo
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

### 4. Módulo SGC — Sistema de Gestión de Calidad ✅ (fase inicial)

#### Propósito
SGC es el dueño del catálogo de proveedores. OC Automatizaciones consume ese catálogo (solo proveedores activos) para el selector de cotizaciones.

#### Flujo de datos
```
SGC crea/edita/desactiva proveedor en sgc.db
        ↓
OC lee GET /api/oc/proveedores → filtra activos desde sgc.db
        ↓
Selector en CotizacionFormPage auto-rellena: nombre, NIT, email
```

#### Backend — Archivos del módulo SGC

| Archivo | Descripción |
|---------|-------------|
| `app/sgc_database.py` | Motor y sesión para `sgc.db` |
| `app/models/sgc.py` | Modelo `ProveedorSGC` con campos marcados `[FORMATO]` para el formato oficial pendiente |
| `app/routers/sgc/proveedores.py` | CRUD completo + `PATCH /toggle-activo` + `POST /extraer` (motor de extracción de documentos) |

#### Endpoints SGC

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sgc/proveedores` | Lista todos (SGC ve activos e inactivos) |
| GET | `/api/sgc/proveedores/{id}` | Detalle de un proveedor |
| POST | `/api/sgc/proveedores` | Crear proveedor |
| PUT | `/api/sgc/proveedores/{id}` | Editar proveedor |
| PATCH | `/api/sgc/proveedores/{id}/toggle-activo` | Activa o desactiva (inactivos desaparecen de OC) |
| POST | `/api/sgc/proveedores/extraer` | Extrae campos desde PDF/Excel/Word sin guardar |

#### Frontend — Páginas SGC

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `SGCPage.tsx` | `/sgc` | Landing con tarjeta de acceso |
| `ProveedoresPage.tsx` | `/sgc/proveedores` | Tabla completa + modal crear/editar con extracción automática |

#### Permisos SGC

| Acción | admin | calidad | área "Gestión de Calidad" |
|--------|-------|---------|--------------------------|
| Ver módulo SGC | ✅ | ✅ | ✅ |
| Crear/editar proveedor | ✅ | ✅ | ✅ |
| Activar/desactivar | ✅ | ✅ | ✅ |

---

## Bases de Datos

| Archivo | Contenido |
|---------|-----------|
| `intranet.db` | Usuarios, roles, autenticación |
| `oc.db` | Solicitudes OC, cotizaciones, órdenes de compra, configuración SMTP |
| `sgc.db` | Proveedores (fuente de verdad del catálogo compartido con OC) |

Resolución de nombres (auxiliar/aprobador) cruza DBs vía consulta directa a `intranet.db` desde `documentos.py`.

---

## Infraestructura

- **Docker Compose** con servicios: `backend`, `frontend`
- **Nginx** como reverse proxy: `/api/` → backend:8001, `/` → frontend:81
- **Volume** `backend_data` para persistencia de `oc.db`, `sgc.db` y archivos OC generados
- **Build context** del backend es `./backend` — los assets (logos, templates, configs de plataforma) deben estar dentro de `backend/app/platforms/{slug}/`

---

## Pendientes / Backlog

### Alta prioridad

- [ ] **Flujo 5** — email al solicitante cuando el producto es entregado (estado `entregada`). Falta `send_entregada()` en `email_service.py` y llamarla desde `marcar_entregada` en `documentos.py`
- [ ] **Logo LOGIMAT** — colocar `logimat_logo.png` en `backend/app/platforms/logimat/logimat_logo.png` (archivo físico, no hay código pendiente)
- [ ] **Prueba end-to-end del webhook** — enviar request real desde Power Automate con datos de formulario y verificar creación de solicitud + email Flujo 1
- [ ] **Dropdown para asignar auxiliar** — UI para que admin elija qué auxiliar asignar (actualmente cada auxiliar se asigna a sí mismo)

### Media prioridad

- [ ] **Dashboard de métricas** — gráficos de tendencias por mes en `KPIPage` (actualmente solo conteos)
- [ ] **Entrenamiento del motor de extracción** — calibrar sinónimos y regex con más cotizaciones reales de los proveedores habituales
- [ ] **Subir y guardar PDF de cotización** — actualmente la extracción no guarda el archivo físico. Falta endpoint para asociar el PDF al `pdf_path` de la cotización

### Baja prioridad / Futuro

- [ ] **SharePoint List push** — al cerrar la solicitud, escribir en SharePoint para trazabilidad histórica
- [ ] **OCR de cotizaciones escaneadas** — Google Vision o Tesseract para PDFs de imagen
- [ ] **Refresh tokens** — mejorar seguridad de sesión (actualmente JWT de 8h sin renovación)
- [ ] **PostgreSQL** — migrar de SQLite para entornos de mayor carga concurrente
- [ ] **Formato OC para plataforma Zymo** — pendiente para fase futura
- [ ] **Notificación al auxiliar cuando directora rechaza cotización** — solo cambia estado, no notifica por email
- [ ] **Historial de estados** — tabla de auditoría con todos los cambios de estado y quién los hizo

### Posibles mejoras identificadas

- **Cotización múltiple con comparación** — cargar 2-3 cotizaciones y mostrar tabla comparativa para que la directora elija
- **Firma digital en la OC** — que la directora "firme" digitalmente desde la intranet antes de enviar
- **Template de email configurable desde UI** — actualmente hardcodeado en `email_service.py`
- **Reenvío de OC** — botón para reenviar sin cambiar el estado
- **Recordatorio automático** — si una solicitud lleva X días en `cotizacion_lista` sin aprobación, re-enviar Flujo 3

---

## Commits recientes relevantes

```
[2026-04-16] Fix extracción: guard valor_total != valor_antes_iva + sinónimo duplicado "precio base"
[2026-04-16] Plataformas imccargo e imcdep: col_referencia configurada; documentos.py escribe placa_ficha
[2026-04-16] OC generada desde template XLSX (openpyxl) + conversión PDF LibreOffice para 3 plataformas
[2026-04-16] Extracción completa: garantia, anticipo, pago_saldo en BD + UI + motor de extracción
[2026-04-16] Botón Generar OC aparece solo después de Aprobación; estado renombrado a "Cotización lista"
[2026-04-15] Módulo SGC — CRUD de proveedores con extracción automática desde documento
[2026-04-15] Emails rediseñados: branding LOGIMAT, valor cotización para directora, fechas hora Colombia
[anterior]   Zona horaria Colombia en frontend (dates.ts) y documentos
[anterior]   Extracción automática de cotizaciones (PDF/Excel/Word) con preview
[anterior]   Logo LOGIMAT real en documento OC, configs dentro de backend/ (fix Docker)
```
