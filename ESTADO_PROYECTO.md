# ZYMO Intranet — Estado del Proyecto

**Última actualización:** 2026-04-17 (sesión 2)
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
- Roles: `admin`, `directivo`, `administrativo`, `talento_cultura`, `comercial`, `operativo`, `empleado`, `compras`, `financiero`
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
(⚠️ Migración a formulario interno planificada — ver Fase 2)
                                        ↓
                              SolicitudOC creada en oc.db
                              Estado: nueva  |  Prioridad: Media (ajustable)
                                        ↓
                         Auxiliar de compras la toma en la intranet
                              Estado: en_cotizacion
                         [Email Flujo 1 → solicitante]
                                        ↓
                         Auxiliar sube cotización del proveedor (PDF/Excel/Word)
                         → Extracción automática de campos
                         → Preview con campos pre-llenados → auxiliar confirma/corrige
                              Estado: cotizacion_lista
                         [Email Flujo 2 → solicitante]
                         [Email Flujo 3 → directora: valor, proveedor, NIT, IVA, fechas]
                                        ↓
                         Directora / Administrativo aprueba cotización
                              Estado: aprobada
                                        ↓
                         Auxiliar genera el documento OC (XLSX → PDF con LibreOffice)
                         Auxiliar confirma email proveedor → envía OC como adjunto
                              Estado: oc_enviada
                         [Email OC → proveedor (adjunto PDF, branding por plataforma)]
                         [Email Flujo 4 → solicitante: copia del pedido realizado]
                                        ↓
                         Auxiliar marca "Ya está en la plataforma"
                              Estado: oc_en_plataforma
                                        ↓
                         Coordinador confirma recepción física desde Módulo Operativo
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

Cada empresa tiene su carpeta en `backend/app/platforms/{slug}/` con template propio y config de branding de email:

| Slug | Empresa | Prefijo OC | Paleta email |
|------|---------|-----------|--------------|
| `logimat` | LOGIMAT S.A.S. | L | Rojo `#C8102E` / blanco |
| `imccargo` | IMC CARGO INTERNATIONAL S.A.S. | C | Azul `#003A70` / amarillo `#FFC72C` / blanco |
| `imcdep` | IMC DEPOSITO S.A.S. | D | Azul `#003A70` / amarillo `#FFC72C` / blanco |

⚠️ **LOGIMAT**: el archivo `logimat_logo.png` debe colocarse manualmente en `backend/app/platforms/logimat/logimat_logo.png`.

#### `config.json` — estructura por plataforma

```json
{
  "nombre": "...",
  "nit": "...",
  "direccion": "...",
  "ciudad": "...",
  "pbx": "...",
  "prefijo_oc": "L|C|D",
  "logo": "filename.png",
  "email": {
    "color_header": "#C8102E",
    "color_acento": "#C8102E",
    "from_name": "Compras LOGIMAT"
  },
  "template": "template.xlsx",
  "print_area": "A1:J64",
  "celdas_dinamicas": { ... },
  "items": { ... }
}
```

---

#### Notificaciones por Email

| Flujo | Evento | Destinatario | Contenido | Branding |
|-------|--------|-------------|-----------|---------|
| Flujo 1 | Auxiliar toma solicitud | Solicitante | Consecutivo, descripción, cantidad, prioridad, fecha | Por plataforma |
| Flujo 2 | Cotización cargada | Solicitante | Consecutivo, fechas | Por plataforma |
| Flujo 3 | Lista para aprobar | Directora/Aprobadora | Valor total, subtotal, IVA, proveedor, NIT, forma pago, plazo | Por plataforma |
| Flujo 4 | OC enviada | Solicitante | Consecutivo, fecha envío, fecha estimada entrega, copia del pedido | Por plataforma |
| Flujo OC | Al marcar OC enviada | Proveedor | Adjunto PDF, tabla formal de ítems, condiciones de pago, contacto empresa | Por plataforma |

**Configuración SMTP y mensajes:**
- Gestionados desde `/oc/configuracion` (solo admin)
- Fallback a variables de entorno `.env`
- Endpoint `POST /api/oc/config/test-email` para verificar conectividad SMTP desde la UI
- Asuntos e intros de cada flujo configurables desde la misma pantalla

⚠️ **Issue conocido:** Si se guardaron credenciales incorrectas en `oc_config` DB, tienen prioridad sobre `.env`. Usar `GET /api/oc/config` para verificar.

---

#### Backend — Archivos del módulo OC

| Archivo | Descripción |
|---------|-------------|
| `app/models/oc.py` | Modelos: `SolicitudOC`, `CotizacionProveedor`, `OrdenCompra`, `Proveedor`, `OcConfig` |
| `app/routers/oc/webhook.py` | `POST /api/oc/webhook/nueva-solicitud` — sin auth, recibe desde Power Automate |
| `app/routers/oc/solicitudes.py` | CRUD de solicitudes + `GET /mis-solicitudes` (por email del usuario autenticado) |
| `app/routers/oc/cotizaciones.py` | Crear, aprobar/rechazar cotizaciones + extracción automática |
| `app/routers/oc/documentos.py` | Generar OC, descargar, marcar-enviada / marcar-en-plataforma / marcar-entregada / cerrar |
| `app/routers/oc/kpis.py` | KPIs: totales, por estado, por plataforma, con/sin IVA |
| `app/routers/oc/config.py` | CRUD `OcConfig` + test SMTP desde UI |
| `app/routers/oc/proveedores.py` | Listado de proveedores activos desde sgc.db |
| `app/services/email_service.py` | Flujos 1–4 + OC a proveedor. Branding dinámico por plataforma. Fechas en hora Colombia |
| `app/services/field_synonyms.py` | Diccionario de sinónimos + `resolve_field()` + `fuzzy_resolve()` |
| `app/platforms/{slug}/config.json` | Config por empresa: nombre, NIT, logo, colores email, celdas dinámicas, ítems |

---

#### Endpoints OC completos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/oc/webhook/nueva-solicitud` | Recibe solicitud desde Power Automate (backward compat.) |
| POST | `/api/oc/solicitudes/crear-interna` | Crea solicitud desde el formulario nativo (cualquier empleado autenticado) |
| GET | `/api/oc/solicitudes` | Lista todas (filtros: estado, plataforma) |
| GET | `/api/oc/solicitudes/mis-solicitudes` | Solicitudes del usuario autenticado (por email) |
| GET | `/api/oc/solicitudes/{id}` | Detalle de una solicitud |
| PATCH | `/api/oc/solicitudes/{id}/asignar` | Asigna auxiliar de compras |
| PATCH | `/api/oc/solicitudes/{id}/estado` | Cambia estado manualmente |
| PATCH | `/api/oc/solicitudes/{id}/prioridad` | Cambia prioridad |
| PATCH | `/api/oc/solicitudes/{id}/gestionar` | Actualiza campos de gestión |
| GET | `/api/oc/solicitudes/{id}/cotizaciones` | Lista cotizaciones de una solicitud |
| POST | `/api/oc/solicitudes/{id}/cotizacion/extraer` | Extrae campos sin guardar — devuelve preview |
| POST | `/api/oc/solicitudes/{id}/cotizacion` | Guarda cotización con todos los campos |
| PATCH | `/api/oc/cotizaciones/{id}/aprobar` | Aprueba cotización |
| PATCH | `/api/oc/cotizaciones/{id}/rechazar` | Rechaza cotización |
| POST | `/api/oc/solicitudes/{id}/generar-oc` | Genera OC XLSX + PDF con LibreOffice |
| GET | `/api/oc/solicitudes/{id}/orden` | Retorna registro de la OC |
| GET | `/api/oc/ordenes/{id}/descargar` | Descarga PDF (fallback XLSX) |
| POST | `/api/oc/solicitudes/{id}/marcar-enviada` | → `oc_enviada`, envía OC al proveedor y copia al solicitante |
| POST | `/api/oc/solicitudes/{id}/marcar-en-plataforma` | → `oc_en_plataforma` (auxiliar confirma ingreso en sistema) |
| POST | `/api/oc/solicitudes/{id}/marcar-entregada` | → `entregada` (coordinador confirma recepción física) |
| POST | `/api/oc/solicitudes/{id}/cerrar` | → `cerrada` |
| GET | `/api/oc/kpis` | KPIs del módulo |
| GET | `/api/oc/proveedores` | Lista proveedores activos |
| GET | `/api/oc/config` | Lee configuración OC (admin) |
| PATCH | `/api/oc/config` | Guarda configuración OC: SMTP, emails, URL intranet (admin) |
| POST | `/api/oc/config/test-email` | Envía correo de prueba con error SMTP exacto (admin) |
| GET | `/api/oc/config/listas` | Lee listas del formulario (cualquier autenticado) |
| PATCH | `/api/oc/config/listas` | Guarda listas del formulario (admin) |

---

#### Frontend — Páginas del módulo OC

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `SolicitudesPage.tsx` | `/oc/solicitudes` | Tabla de todas las solicitudes con filtros |
| `SolicitudDetallePage.tsx` | `/oc/solicitudes/:id` | Detalle: info, cotizaciones, OC, timeline, acciones por estado |
| `CotizacionFormPage.tsx` | `/oc/solicitudes/:id/cotizacion` | Formulario con extracción automática y 10 campos |
| `AprobacionPage.tsx` | `/oc/aprobacion` | Vista del aprobador |
| `KPIPage.tsx` | `/oc/kpis` | Dashboard de KPIs con toggle sin/con IVA |
| `OcConfigPage.tsx` | `/oc/configuracion` | SMTP, emails, listas del formulario, botón test SMTP (solo admin) |

---

#### Permisos por rol — Módulo OC

| Acción | admin | directivo | administrativo | compras |
|--------|-------|-----------|----------------|---------|
| Ver solicitudes | ✅ | ✅ | ✅ | ✅ |
| Cargar cotización | ✅ | ✅ | ✅ | ✅ |
| Aprobar/rechazar | ✅ | ✅ | ✅ | ✗ |
| Generar y enviar OC | ✅ | ✅ | ✅ | ✅ |
| Marcar en plataforma | ✅ | ✅ | ✅ | ✅ |
| Confirmar entrega | ✅ | ✅ | ✅ | ✅ + solicitante propietario |
| Configuración SMTP | ✅ | ✗ | ✗ | ✗ |

---

### 4. Módulo SGC — Sistema de Gestión de Calidad ✅

SGC es el dueño del catálogo de proveedores. OC Automatizaciones consume ese catálogo.

| Archivo | Descripción |
|---------|-------------|
| `app/sgc_database.py` | Motor y sesión para `sgc.db` |
| `app/models/sgc.py` | Modelo `ProveedorSGC` |
| `app/routers/sgc/proveedores.py` | CRUD + toggle-activo + extracción desde documento |

| Página | Ruta |
|--------|------|
| `SGCPage.tsx` | `/sgc` |
| `ProveedoresPage.tsx` | `/sgc/proveedores` |

Acceso: role `calidad` o área `Gestión de Calidad`.

---

### 5. Módulo Operativo ✅ (Fase 1 + Fase 2 — formulario interno)

Permite a cualquier empleado autenticado crear solicitudes de compra directamente desde la intranet, y a coordinadores/solicitantes ver el estado de sus pedidos y confirmar la recepción física.

#### Flujo Operativo

```
Empleado abre /operativo/nueva-solicitud
→ Nombre, área, fecha → auto desde perfil autenticado
→ Completa: prioridad, categoría, grupo, descripción, cantidad, plataforma,
             cliente, condición, placa/ficha, observaciones
→ POST /api/oc/solicitudes/crear-interna
→ Consecutivo OS-YYYY-XXXX generado automáticamente
→ Email automático a auxiliar de compras (+ fallback a directora)
→ Redirige a /operativo/mis-solicitudes

Coordinador abre /operativo/mis-solicitudes
→ Ve sus solicitudes filtradas por su email
→ Cuando estado = oc_en_plataforma → botón "Confirmar recepción"
→ Confirmación en dos pasos (para evitar clics accidentales)
→ POST /api/oc/solicitudes/{id}/marcar-entregada
→ Estado: entregada
```

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `OperativoPage.tsx` | `/operativo` | Hub con tarjeta a Mis Solicitudes |
| `MisSolicitudesPage.tsx` | `/operativo/mis-solicitudes` | Lista de solicitudes propias + confirmación recepción + botón "Nueva solicitud" |
| `NuevaSolicitudPage.tsx` | `/operativo/nueva-solicitud` | Formulario nativo de creación — reemplaza MS Forms + Power Automate |

Acceso: cualquier usuario autenticado (formulario) — área `Operaciones` OR role `operativo`/`operaciones` para confirmar recepción.

---

### 6. Módulo Financiero ✅ (Fase 1 — gestión de facturas)

Permite a contabilidad cargar facturas de proveedores, extraer campos automáticamente y validarlas contra la OC aprobada.

#### Flujo Financiero

```
OC en estado oc_en_plataforma / entregada / cerrada
→ Contabilidad abre /financiero/facturas
→ Selecciona la OC → sube PDF de factura
→ Motor extrae: número factura, valor, fecha, NIT, nombre proveedor
→ Validación automática contra: valor_aprobado_oc (tolerancia 1%), NIT, nombre
→ Estado: validada ✅ o con_diferencias ⚠️
→ Contabilidad puede editar campos y re-validar
→ Puede descargar la OC original desde la misma vista
```

#### Backend — Archivos del módulo Financiero

| Archivo | Descripción |
|---------|-------------|
| `app/financiero_database.py` | Motor y sesión para `financiero.db` |
| `app/models/financiero.py` | `FacturaProveedor` + `ValidacionFactura` |
| `app/routers/financiero/facturas.py` | 7 endpoints + motor de extracción de facturas + validación |
| `app/core/deps.py` | Guard `require_financiero` (admin + role financiero + área contabilidad) |
| `app/config.py` | `facturas_dir`: directorio de almacenamiento (default `/app/data/facturas`) |

#### Endpoints Financiero

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/financiero/facturas` | Lista OCs elegibles enriquecidas con su factura |
| POST | `/api/financiero/facturas/{solicitud_id}` | Sube archivo + extrae campos + crea/actualiza factura |
| GET | `/api/financiero/facturas/{factura_id}` | Detalle de factura |
| PATCH | `/api/financiero/facturas/{factura_id}` | Actualiza campos manualmente |
| GET | `/api/financiero/facturas/{factura_id}/validaciones` | Resultados campo a campo |
| POST | `/api/financiero/facturas/{factura_id}/validar` | Ejecuta validación vs OC |
| GET | `/api/financiero/solicitudes/{solicitud_id}/descargar-oc` | Descarga OC para contabilidad |

#### Frontend — Páginas Financiero

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `FinancieroPage.tsx` | `/financiero` | Hub con badge de pendientes sin factura |
| `FacturasPage.tsx` | `/financiero/facturas` | Lista con tabs: Todas / Sin factura / Pendientes / Validadas / Con diferencias |
| `FacturaDetallePage.tsx` | `/financiero/facturas/:solicitudId` | Subir factura, editar campos, tabla validación, descargar OC |

Acceso: área `contabilidad` OR role `financiero`.

#### Lógica de validación

| Campo | Criterio | Comportamiento si no se encuentra |
|-------|----------|----------------------------------|
| `valor` | Diferencia ≤ 1% del valor aprobado OC | `cumple=False` + observación explicativa |
| `nit_proveedor` | Normalizado (sin puntos/guiones) == NIT cotización | `cumple=False` + observación |
| `nombre_proveedor` | Coincidencia parcial case-insensitive | `cumple=False` + observación |

Estado factura: `validada` si todos cumplen, `con_diferencias` si alguno falla.

#### Pendientes Financiero (backlog)

- [ ] Endpoint `GET /facturas/{id}/pdf` para previsualizar la factura subida en el browser
- [ ] Notificación a compras cuando factura tiene diferencias (email futuro)
- [ ] Compras podrá ver facturas de sus OCs (propuesta futura — actualmente solo contabilidad)

---

## Bases de Datos

| Archivo | Contenido |
|---------|-----------|
| `intranet.db` | Usuarios, roles, áreas, sedes, autenticación |
| `oc.db` | Solicitudes OC, cotizaciones, órdenes de compra, configuración SMTP/email |
| `sgc.db` | Proveedores (fuente de verdad compartida con OC) |
| `financiero.db` | Facturas de proveedores + resultados de validación campo a campo |

**Patrón de migración:** columnas nuevas se agregan en `_migrate_*_db()` en `main.py` via `ALTER TABLE IF FAILS`. `create_all()` solo crea tablas nuevas — nunca altera existentes.

---

## Infraestructura

- **Docker Compose** con servicios: `backend`, `frontend`
- **Nginx** como reverse proxy: `/api/` → backend:8001, `/` → frontend:81
- **Volume** `backend_data` mapeado a `/app/data` — contiene todas las DBs y archivos generados:
  - `oc.db`, `sgc.db`, `financiero.db`
  - `oc_docs/` — OCs generadas (XLSX + PDF)
  - `facturas/` — facturas subidas por contabilidad
- **Build context** del backend: `./backend` — los assets (logos, templates, configs) en `backend/app/platforms/{slug}/`

---

## Permisos y Acceso por Módulo

| Módulo | Roles con acceso | Áreas con acceso |
|--------|-----------------|-----------------|
| OC Automatizaciones | admin, directivo, administrativo, compras | Compras |
| SGC | admin, calidad | Gestión de Calidad |
| Operativo | admin, operativo, operaciones | Operaciones |
| Financiero | admin, financiero | contabilidad |
| Mis Solicitudes (OC) | Cualquier usuario autenticado | — (filtra por email) |

---

## Roadmap

### Sprint emails + mejoras (completado 2026-04-19) ✅

- [x] **Botón test SMTP** ✅
- [x] **Branding multi-plataforma** ✅ — `_base()` dinámico, configurable desde OcConfigPage
- [x] **Email OC al proveedor formal** ✅ — tabla de ítems, condiciones de pago
- [x] **Copia al solicitante** ✅ — CC automático en `send_oc_a_proveedor`
- [x] **Templates configurables** ✅ — prefijo + intros flujos 1–4 desde OcConfigPage
- [x] **Email entrega confirmada** ✅ — `send_entrega_confirmada` al confirmar recepción física
- [x] **Email rechazo cotización** ✅ — `send_rechazo_cotizacion` al auxiliar cuando directora rechaza
- [x] **Logo LOGIMAT** ✅ — copiado a `backend/app/platforms/logimat/logo_logimat.png`

### Fase 2 — Formulario interno en Módulo Operativo ✅ COMPLETADO

**Objetivo:** Reemplazar MS Forms + Power Automate con un formulario nativo en la intranet.

**Implementado:**
- `POST /api/oc/solicitudes/crear-interna` — solicitante_* tomados del usuario autenticado, consecutivo OS-YYYY-XXXX con retry en colisión
- `GET/PATCH /api/oc/config/listas` — listas de dropdowns administradas por compras desde `/oc/configuracion`
- `NuevaSolicitudPage.tsx` — formulario con dropdowns dinámicos (prioridad, categoría, grupo, cliente, condición), campos de texto, plataforma, validación frontend + backend
- Email automático a auxiliar de compras con formato de tabla HTML al crear solicitud
- Webhook Power Automate mantenido para compatibilidad hacia atrás

**Paquetes (Fase 2b — futuro):**
- El coordinador guarda templates de solicitudes frecuentes
- Un click genera N solicitudes pre-llenadas de golpe
- Caso de uso: "Kit mantenimiento mensual camión X" → 3-5 solicitudes simultáneas

---

## Pendientes / Backlog consolidado

### Alta prioridad ✅ COMPLETADO 2026-04-19

- [x] **Logo LOGIMAT** ✅
- [x] **Email entrega confirmada** ✅
- [x] **Email rechazo cotización al auxiliar** ✅

### Media prioridad ✅ COMPLETADO 2026-04-19

- [x] **Preview factura PDF** ✅ — `GET /api/financiero/facturas/{id}/pdf` + botón "Ver PDF" en FacturaDetallePage
- [x] **Dashboard métricas mensuales** ✅ — `MesChart` en KPIPage, tendencia últimos 6 meses
- [x] **Dropdown asignar auxiliar** ✅ — select en SolicitudDetallePage para admin, endpoint `GET /api/oc/usuarios-compras`
- [x] **Guardar PDF cotización** ✅ — archivo fuente persiste en `/app/data/cotizaciones/{id}.ext`

### Pendiente / Futuro

- [ ] **SharePoint List push** — al cerrar solicitud, escribir en SharePoint
- [ ] **OCR cotizaciones escaneadas** — Google Vision o Tesseract
- [ ] **Refresh tokens** — JWT de 8h sin renovación
- [ ] **PostgreSQL** — migrar de SQLite para mayor concurrencia
- [ ] **Historial de estados** — tabla de auditoría completa
- [ ] **Cotización múltiple con comparación** — tabla comparativa para el aprobador
- [ ] **Notificación a compras** cuando factura tiene diferencias (módulo financiero)
- [ ] **Compras puede ver facturas** de sus OCs (actualmente solo contabilidad)
- [ ] **Paquetes Operativo** — templates de solicitudes recurrentes (fase 2b)

---

## Modelo de datos — Estados OC

```
nueva → en_cotizacion → cotizacion_lista → aprobada
                                        ↘ rechazada → en_cotizacion

aprobada → oc_enviada → oc_en_plataforma → entregada → cerrada
```

| Estado | Quién avanza | Descripción |
|--------|-------------|-------------|
| `nueva` | Sistema (webhook/form) | Solicitud recibida, sin asignar |
| `en_cotizacion` | Auxiliar compras | En búsqueda de cotización |
| `cotizacion_lista` | Auxiliar compras | Cotización cargada, pendiente aprobación |
| `aprobada` | Directora / Administrativo | Cotización aprobada, listo para OC |
| `rechazada` | Directora / Administrativo | Cotización rechazada, vuelve a cotizar |
| `oc_enviada` | Auxiliar compras | OC enviada al proveedor |
| `oc_en_plataforma` | Auxiliar compras | Pedido ingresado en el sistema interno |
| `entregada` | Coordinador / Solicitante | Recepción física confirmada |
| `cerrada` | Auxiliar compras | Proceso completo |

---

## Commits recientes relevantes

```
[2026-04-17] Fase 2 Operativo: formulario interno NuevaSolicitudPage + crear-interna + listas configurables
[2026-04-17] Fix: consecutivo_os único (índice único + retry loop IntegrityError)
[2026-04-17] Fix: nivel_prioridad validado con Literal["Alta","Media","Baja"] en crear-interna
[2026-04-17] Fix: invalidar cache ["oc","solicitudes"] al crear solicitud interna
[2026-04-17] Fix: estado de error visible en NuevaSolicitudPage cuando falla carga de listas
[2026-04-17] Fix: log.warning en _get_runtime_config (antes excepción silenciosa)
[2026-04-17] Test SMTP: POST /api/oc/config/test-email con error exacto de smtplib
[2026-04-17] OcConfigPage: email_compras, intranet_url, listas del formulario con ListaEditor
[2026-04-17] Módulo Financiero: facturas, motor extracción, validación vs OC
[2026-04-17] Módulo Operativo Fase 1: mis-solicitudes + confirmar recepción física
[2026-04-17] Estado oc_en_plataforma: nuevo estado entre oc_enviada y entregada
[2026-04-17] KPIs con toggle sin/con IVA; IVA visible en panel aprobación directora
[2026-04-16] Fix extracción: guard valor_total != valor_antes_iva + sinónimo duplicado
[2026-04-16] OC generada desde template XLSX + conversión PDF LibreOffice
[2026-04-15] Módulo SGC — CRUD de proveedores con extracción automática
```
