# OC Automatizaciones — Contexto para Claude Code
> Módulo de automatización de órdenes de compra integrado dentro del repo `zymo-intranet`.
> NO es un repo separado. Vive como un módulo más de la intranet, igual que el futuro módulo de capacitaciones.

---

## 1. Decisión Arquitectural

OC Automatizaciones **no es una app independiente**. Es un módulo del monorepo `zymo-intranet` con:
- Su propio conjunto de rutas en el **backend FastAPI existente** (`backend/app/routers/oc/`)
- Sus propias páginas en el **frontend React existente** (`frontend/src/pages/oc/`)
- Sus propios modelos SQLModel en la **misma base de datos SQLite** de la intranet (`intranet.db`)
- Acceso vía `https://oc.zymointranet.com` (ya configurado en Cloudflare como hostname del mismo servidor)

### Por qué dentro de la intranet y no repo separado
- Reutiliza el sistema de usuarios, roles y autenticación JWT ya existente — cero duplicación
- No requiere login doble — el SSO de la intranet ya lo cubre
- El token que genera la intranet al hacer login tiene `role` en el payload → el módulo OC lee ese role directamente
- Un solo Docker, un solo despliegue, una sola base de datos

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI + SQLModel + SQLite (mismo que la intranet) |
| Frontend | React + Vite + TypeScript + Tailwind (mismo que la intranet) |
| Auth | JWT compartido con la intranet — misma `SECRET_KEY`, mismo `sub: email` |
| Email | SMTP o EmailJS para envío de OC a proveedor y notificaciones |
| Integración MS | HTTP requests a Power Automate webhooks (URLs de PA como variables de entorno) |
| PDF | `python-docx` o `WeasyPrint` en el backend para generar la OC en PDF |

---

## 3. Roles y Permisos

Los roles vienen del modelo `User` y `Role` **ya existentes** en la intranet. No se crean roles nuevos.

| Role (intranet) | Acceso en OC Automatizaciones |
|---|---|
| `admin` | Acceso total — ve todo, configura proveedores, puede anular cualquier OC |
| `directivo` | Panel de aprobación — ve solicitudes pendientes, aprueba o rechaza cotizaciones |
| `talento_cultura` | Puede crear solicitudes de compra (actúa como coordinador) |
| `comercial` | Puede crear solicitudes de compra |
| `operativo` | Puede crear solicitudes de compra |
| `empleado` | Puede crear solicitudes de compra |

> El rol de **Auxiliar de Compras** NO existe como rol separado. El admin asigna el área "Compras" al usuario empleado y el sistema filtra por `user.area == "Compras"` para mostrar el panel de gestión de cotizaciones.

**Cómo diferencia el sistema quién puede gestionar cotizaciones:**
```python
# En los endpoints de gestión (recibir cotización, elegir proveedor, etc.)
def require_compras(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin" and current_user.area != "Compras":
        raise HTTPException(403, "Solo el área de Compras puede gestionar cotizaciones")
    return current_user
```

---

## 4. Flujo de Negocio Completo

```
[1] COORDINADOR / EMPLEADO
    Llena el Microsoft Form (ya existe en SharePoint)
            ↓
[2] POWER AUTOMATE
    Trigger: ítem nuevo en el List de Compras
    → Crea ítem en el List con CONSECUTIVO O.S. y estado "Nueva Solicitud"
    → Hace POST al webhook de OC Automatizaciones con los datos de la solicitud
    → URL del webhook: POST /api/oc/webhook/nueva-solicitud
            ↓
[3] OC AUTOMATIZACIONES — Backend
    Recibe el webhook de PA
    → Crea la SolicitudOC en la base de datos
    → Genera alerta en tiempo real para el área de Compras (o polling)
            ↓
[4] AUXILIAR DE COMPRAS
    Ve la nueva solicitud en su panel dentro de OC Automatizaciones
    → Revisa el detalle (descripción, cantidad, prioridad, etc.)
    → Sale a conseguir cotización con el/los proveedores (fuera del sistema)
    → Recibe el PDF de cotización del proveedor (por email o físico)
            ↓
[5] CARGA DE COTIZACIÓN (dos caminos)
    CAMINO A — PDF legible:
        Auxiliar sube el PDF → backend llama a Claude API para extracción
        → Si Claude extrae bien: muestra formulario pre-llenado para confirmar
        → Auxiliar confirma o ajusta → guarda
    CAMINO B — PDF ilegible / formato raro / falla extracción:
        Sistema muestra formulario manual simple con estos campos:
        · Nombre del proveedor
        · Valor unitario
        · Valor total
        · Número de cotización del proveedor
        · Fecha de vigencia
        · Observaciones
        Auxiliar rellena manualmente → guarda
            ↓
[6] NOTIFICACIÓN AL DIRECTIVO
    Sistema envía notificación interna (badge en la intranet) al usuario con role "directivo"
    → El directivo ve en su panel: resumen de la solicitud + cotización adjunta
            ↓
[7] APROBACIÓN
    El directivo dentro de OC Automatizaciones:
    → Aprueba con valor aprobado y observaciones   → Estado: "Aprobada"
    → Rechaza con motivo                           → Estado: "Rechazada" → vuelve al Auxiliar
            ↓
[8] GENERACIÓN DE OC (solo si aprobada)
    Backend genera automáticamente la OC en PDF con:
    · Número de OC correlativo (OC-2026-0001)
    · Datos del proveedor
    · Detalle del pedido
    · Valor aprobado
    · Firma del directivo (nombre + cargo)
    → Envía email al proveedor con PDF adjunto
    → Envía email/notificación al coordinador que hizo la solicitud
    → Estado: "OC Enviada"
            ↓
[9] POWER AUTOMATE — Actualización del List
    OC Automatizaciones hace POST al webhook de PA con:
    · # O.C generado
    · Proveedor elegido
    · Valor aprobado
    · Fecha de envío OC
    PA actualiza el ítem correspondiente en el List de SharePoint
    → El List queda como registro histórico y documental (trazabilidad externa)
            ↓
[10] CIERRE
    El coordinador confirma recibido (por email con botón, o dentro de la intranet)
    → Sistema registra Fecha de Recibido
    → Estado: "Entregada"
    → PA actualiza el List con ENTREGADO = Sí y Fecha de Recibido
```

---

## 5. Estados de una Solicitud OC

```python
class EstadoOC(str, Enum):
    nueva           = "nueva"           # Recién llegada del Forms/PA
    en_cotizacion   = "en_cotizacion"   # Auxiliar está consiguiendo cotización
    pendiente_aprobacion = "pendiente_aprobacion"  # Cotización cargada, esperando directivo
    aprobada        = "aprobada"        # Directivo aprobó
    rechazada       = "rechazada"       # Directivo rechazó — vuelve a Auxiliar
    oc_enviada      = "oc_enviada"      # OC generada y enviada al proveedor
    entregada       = "entregada"       # Coordinador confirmó recibido
    cerrada         = "cerrada"         # Factura registrada — proceso completo
```

---

## 6. Modelos de Datos (nuevos en intranet.db)

```python
# backend/app/models/oc.py

class SolicitudOC(SQLModel, table=True):
    __tablename__ = "oc_solicitudes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # Datos que vienen de SharePoint/Forms via webhook de PA
    consecutivo_os: str              # OS-2026-0001 — viene del List
    descripcion: str                 # DETALLE "DESCRIPCION MATERIAL"
    categoria: str | None            # CATEGORIA / ESTATUS DE SOLICITUD
    grupo_articulos: str | None      # GRUPO ARTICULOS
    cantidad: int
    nivel_prioridad: str             # Alta / Media / Baja
    solicitante_nombre: str          # Quien hizo la solicitud en Forms
    solicitante_email: str | None
    area_solicitante: str | None     # AREA
    sede: str | None                 # PLATAFORMA (IMCCARGO / LOGIMAT / etc.)
    cliente: str | None              # CLIENTE
    condicion: str | None            # CONDICION
    observaciones_solicitante: str | None
    placa_ficha: str | None          # Placa Vehiculo o No ficha tecnica
    fecha_proximo_mantenimiento: date | None

    # Gestión interna
    estado: str = Field(default="nueva")  # EstadoOC
    auxiliar_id: int | None = Field(foreign_key="user.id")  # Auxiliar asignado
    
    # Fechas del proceso
    fecha_solicitud: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_cotizacion: datetime | None = None
    fecha_aprobacion: datetime | None = None
    fecha_envio_oc: datetime | None = None
    fecha_recibido: datetime | None = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CotizacionProveedor(SQLModel, table=True):
    __tablename__ = "oc_cotizaciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="oc_solicitudes.id")

    # Datos del proveedor y cotización
    proveedor_nombre: str
    proveedor_email: str | None
    numero_cotizacion_proveedor: str | None  # El número que le da el proveedor a su cot.
    valor_unitario: float
    valor_total: float
    fecha_vigencia: date | None
    observaciones: str | None

    # PDF adjunto
    pdf_path: str | None             # Ruta al archivo subido en el servidor
    extraccion_automatica: bool = False  # Si Claude pudo extraer los datos
    
    # Aprobación
    aprobada: bool | None = None
    valor_aprobado: float | None = None
    aprobado_por_id: int | None = Field(foreign_key="user.id")
    observaciones_aprobacion: str | None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrdenCompra(SQLModel, table=True):
    __tablename__ = "oc_ordenes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="oc_solicitudes.id")
    cotizacion_id: uuid.UUID = Field(foreign_key="oc_cotizaciones.id")

    numero_oc: str                   # OC-2026-0001
    pdf_path: str | None             # PDF generado de la OC
    
    enviada_proveedor: bool = False
    enviada_coordinador: bool = False
    email_proveedor: str | None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Proveedor(SQLModel, table=True):
    __tablename__ = "oc_proveedores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre: str = Field(unique=True)
    email: str | None
    telefono: str | None
    nit: str | None
    categoria: str | None            # Para qué tipo de compras suele usarse
    activo: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

---

## 7. Endpoints del Backend (nuevos)

```
# Webhook — recibe datos de Power Automate
POST  /api/oc/webhook/nueva-solicitud     ← PA llama esto cuando hay Forms nuevo
POST  /api/oc/webhook/actualizar-estado   ← PA puede llamar esto para sincronizar

# Solicitudes
GET   /api/oc/solicitudes                 ← Lista con filtros (estado, fecha, sede)
GET   /api/oc/solicitudes/{id}            ← Detalle completo
PATCH /api/oc/solicitudes/{id}/asignar    ← Auxiliar se asigna la solicitud
PATCH /api/oc/solicitudes/{id}/estado     ← Cambio de estado manual si necesario

# Cotizaciones de proveedores
POST  /api/oc/solicitudes/{id}/cotizacion          ← Carga cotización (manual o PDF)
POST  /api/oc/solicitudes/{id}/cotizacion/extraer  ← Claude API extrae datos del PDF
PATCH /api/oc/cotizaciones/{id}/aprobar            ← Directivo aprueba
PATCH /api/oc/cotizaciones/{id}/rechazar           ← Directivo rechaza

# OC
POST  /api/oc/cotizaciones/{id}/generar-oc  ← Genera PDF y envía emails
GET   /api/oc/ordenes                        ← Lista de OCs generadas
GET   /api/oc/ordenes/{id}/pdf               ← Descarga el PDF de la OC
PATCH /api/oc/ordenes/{id}/confirmar-entrega ← Coordinador confirma recibido

# Proveedores (catálogo interno)
GET   /api/oc/proveedores
POST  /api/oc/proveedores
PUT   /api/oc/proveedores/{id}

# Dashboard
GET   /api/oc/dashboard                     ← KPIs: solicitudes por estado, tiempos, etc.
```

---

## 8. Estructura de Carpetas en el Repo

```
zymo-intranet/
├── backend/
│   └── app/
│       ├── models/
│       │   ├── user.py          ← existente, no tocar
│       │   ├── role.py          ← existente, no tocar
│       │   └── oc.py            ← NUEVO — todos los modelos de OC
│       ├── routers/
│       │   ├── auth.py          ← existente, no tocar
│       │   ├── users.py         ← existente, no tocar
│       │   └── oc/              ← NUEVO — carpeta módulo OC
│       │       ├── __init__.py
│       │       ├── router.py    ← registra todos los sub-routers
│       │       ├── solicitudes.py
│       │       ├── cotizaciones.py
│       │       ├── ordenes.py
│       │       ├── proveedores.py
│       │       ├── webhook.py   ← recibe eventos de Power Automate
│       │       ├── extractor.py ← lógica Claude API para extraer PDF
│       │       ├── pdf_gen.py   ← generación del PDF de la OC
│       │       └── dashboard.py
│       ├── main.py              ← agregar include_router(oc_router)
│       └── config.py            ← agregar vars: CLAUDE_API_KEY, PA_WEBHOOK_URL,
│                                               SMTP_HOST, SMTP_USER, SMTP_PASSWORD,
│                                               OC_WEBHOOK_SECRET
│
└── frontend/
    └── src/
        ├── pages/
        │   └── oc/              ← NUEVO — páginas del módulo OC
        │       ├── OCDashboardPage.tsx
        │       ├── SolicitudesPage.tsx
        │       ├── SolicitudDetallePage.tsx
        │       ├── CotizacionFormPage.tsx   ← con uploader PDF + form manual
        │       ├── AprobacionPage.tsx       ← vista del directivo
        │       └── OrdenesPage.tsx
        ├── components/
        │   └── oc/              ← NUEVO — componentes reutilizables del módulo
        │       ├── SolicitudCard.tsx
        │       ├── EstadoBadge.tsx
        │       ├── CotizacionForm.tsx
        │       └── PDFUploader.tsx
        └── App.tsx              ← agregar rutas /oc/*
```

---

## 9. Integración con Power Automate (Microsoft)

### PA → OC (entrada de solicitudes)
Power Automate llama al webhook de la intranet cuando hay una solicitud nueva en el List:

```
POST https://oc.zymointranet.com/api/oc/webhook/nueva-solicitud
Headers:
  X-PA-Secret: {OC_WEBHOOK_SECRET}   ← para verificar que viene de PA
Body (JSON):
{
  "consecutivo_os": "OS-2026-0001",
  "descripcion": "Filtros para camión",
  "categoria": "Mantenimiento",
  "cantidad": 4,
  "nivel_prioridad": "Alta",
  "solicitante_nombre": "Juan Pérez",
  "solicitante_email": "juan@grupozymo.com",
  "area": "Operaciones",
  "sede": "LOGIMAT",
  ...
}
```

### OC → PA (actualización del List al generar OC)
Cuando se genera la OC, el backend llama al webhook de PA para actualizar el List:

```python
# En pdf_gen.py o ordenes.py — después de generar la OC
import httpx

async def notificar_pa_oc_generada(consecutivo_os: str, numero_oc: str, ...):
    async with httpx.AsyncClient() as client:
        await client.post(
            settings.pa_webhook_url,   # URL del flujo de PA configurada en .env
            json={
                "consecutivo_os": consecutivo_os,
                "numero_oc": numero_oc,
                "proveedor": proveedor_nombre,
                "valor_aprobado": valor,
                "fecha_envio_oc": fecha.isoformat(),
            }
        )
```

---

## 10. Extracción de PDF con Claude API

```python
# backend/app/routers/oc/extractor.py

import anthropic
import base64

async def extraer_cotizacion_de_pdf(pdf_bytes: bytes) -> dict:
    """
    Intenta extraer datos de una cotización de proveedor usando Claude.
    Retorna dict con los campos extraídos, o dict vacío si falla.
    """
    client = anthropic.Anthropic(api_key=settings.claude_api_key)
    
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")
    
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": """Extrae los siguientes datos de esta cotización de proveedor.
Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni backticks.
Si un campo no aparece en el documento, usa null.

{
  "proveedor_nombre": "nombre de la empresa proveedora",
  "numero_cotizacion_proveedor": "número o código de la cotización",
  "valor_unitario": número o null,
  "valor_total": número o null,
  "fecha_vigencia": "YYYY-MM-DD o null",
  "observaciones": "condiciones de pago, tiempos de entrega, garantías u otro dato relevante"
}"""
                    }
                ],
            }
        ],
    )
    
    try:
        import json
        return json.loads(message.content[0].text)
    except Exception:
        return {}  # Falla silenciosa → frontend muestra formulario manual
```

---

## 11. Variables de Entorno Nuevas (backend/.env)

```bash
# Existentes — no tocar
SECRET_KEY=...
DATABASE_URL=sqlite:///./data/intranet.db
FIRST_ADMIN_EMAIL=...
FIRST_ADMIN_PASSWORD=...
CORS_ORIGINS=...

# Nuevas para OC Automatizaciones
CLAUDE_API_KEY=sk-ant-...              # API key de Anthropic para extracción de PDFs
PA_WEBHOOK_URL=https://prod-xx...      # URL del flujo de PA que actualiza el List
OC_WEBHOOK_SECRET=...                  # Secret para verificar que PA es quien llama
SMTP_HOST=smtp.office365.com           # Para envío de emails (OC al proveedor)
SMTP_PORT=587
SMTP_USER=compras@grupozymo.com
SMTP_PASSWORD=...
```

---

## 12. Diseño del Frontend

El módulo OC hereda el diseño y componentes de la intranet. No reinventa nada.

**Vistas por rol:**

| Vista | Quien la ve |
|---|---|
| Dashboard OC (KPIs generales) | admin, directivo |
| Lista de solicitudes — panel Compras | empleados con area="Compras", admin |
| Detalle de solicitud + carga cotización | empleados con area="Compras", admin |
| Panel de aprobación | directivo, admin |
| Lista de OCs generadas | admin, directivo, area="Compras" |

**Rutas React nuevas:**
```
/oc                    → OCDashboardPage (o redirect a /oc/solicitudes)
/oc/solicitudes        → SolicitudesPage
/oc/solicitudes/:id    → SolicitudDetallePage
/oc/solicitudes/:id/cotizar → CotizacionFormPage
/oc/aprobacion         → AprobacionPage (solo directivo/admin)
/oc/ordenes            → OrdenesPage
```

---

## 13. Fases de Desarrollo

| Fase | Alcance | Entregable |
|---|---|---|
| **Fase 1** | Modelos + migración + endpoints CRUD básicos de solicitudes y proveedores | Backend funcional, Swagger documentado |
| **Fase 2** | Webhook de entrada (PA → OC) + panel de solicitudes en frontend | Auxiliar puede ver solicitudes nuevas |
| **Fase 3** | Carga de cotización: uploader PDF + extractor Claude + form manual | Auxiliar puede cargar cotizaciones |
| **Fase 4** | Panel de aprobación del directivo | Directivo puede aprobar/rechazar |
| **Fase 5** | Generación de OC en PDF + envío por email | OC generada y enviada automáticamente |
| **Fase 6** | Webhook de salida (OC → PA actualiza List) + confirmación de entrega | Ciclo completo cerrado |
| **Fase 7** | Dashboard con KPIs e indicadores de tiempo | Métricas de gestión de compras |

---

*Proyecto: Grupo ZYMO — Analista de Desarrollo: Andres Quintero*
*Repo: zymo-intranet | Módulo: OC Automatizaciones*
*Stack: FastAPI + SQLModel + SQLite + React + Vite + TypeScript + Tailwind*
