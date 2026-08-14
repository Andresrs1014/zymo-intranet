import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlmodel import Session, select

from app.database import create_db_and_tables, get_engine
from app.oc_database import create_oc_tables, get_oc_engine
from app.sgc_database import create_sgc_tables
from app.financiero_database import create_financiero_tables
from app.agent_database import create_agent_tables
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role  # noqa: F401
from app.models.area import Area  # noqa: F401
from app.models.sede import Sede  # noqa: F401
from app.models.oc import SolicitudOC, CotizacionProveedor, OrdenCompra, Proveedor, OcConfig, HistorialEstado, PaqueteSolicitud  # noqa: F401
from app.models.sgc import ProveedorSGC  # noqa: F401
from app.models.financiero import FacturaProveedor, ValidacionFactura  # noqa: F401
from app.models.draft import FormDraft  # noqa: F401
from app.config import settings
from app.routers import auth, users, roles
from app.routers import areas as areas_router
from app.routers import sedes as sedes_router
from app.routers.oc.router import router as oc_router
from app.routers.sgc.router import router as sgc_router
from app.routers.financiero.router import router as financiero_router
from app.routers.agentes import router as agentes_router
from app.routers.zymo import router as zymo_router
from app.gerencial_database import create_gerencial_tables
from app.routers.gerencial import router as gerencial_router
from app.personal_database import create_personal_tables
from app.routers.personal import router as personal_router
from app.routers.tc_agenda import router as tc_agenda_router
from app.routers.tc_cap_coordinador import router as tc_cap_coordinador_router
from app.routers.tc_formatos import router as tc_formatos_router
from app.routers.tc_evaluaciones import router as tc_evaluaciones_router
from app.routers.tc_capacitaciones import router as tc_caps_router
from app.routers.tc_aprobaciones import router as tc_aprobaciones_router
from app.routers.tc_clientes import router as tc_clientes_router
from app.routers.oper_clientes import router as oper_clientes_router
from app.routers.tc_paquetes import router as tc_paquetes_router
from app.routers.borradores import router as borradores_router
from app.routers.admin.extraccion import router as admin_extraccion_router
from app.routers.admin.smtp_config import router as admin_smtp_config_router
from app.routers.admin.whatsapp_config import router as admin_whatsapp_config_router
from app.routers.whatsapp import router as whatsapp_router
from app.routers.user_tools import router as user_tools_router
from app.routers.tasks_v2 import router as tasks_v2_router
from app.routers.netvault import router as netvault_router
from app.routers.mantenimiento.router import router as mantenimiento_router
from app.routers.sig_pdf import router as sig_pdf_router
from app.models.mantenimiento import SolicitudMantenimiento, TipoMantenimientoConfig, HistorialMantenimiento  # noqa: F401
from app.models.analysis_kind import AnalysisKind
from app.models.rubrica import RubricaCategoria


_DEFAULT_ROLES = [
    {
        "name": "admin",
        "label": "Administrador",
        "description": "Acceso total al sistema",
        "app_permissions": [],  # admin bypass explícito en código
    },
    {
        "name": "directivo",
        "label": "Directivo",
        "description": "Dirección — OC (ver/aprobar) y apps externas",
        "app_permissions": ["matriz", "mod_oc_ver", "mod_oc_aprobar"],
    },
    {
        "name": "talento_cultura",
        "label": "Talento y Cultura",
        "description": "Gestión de talento humano",
        "app_permissions": ["matriz", "mod_tc", "mod_tc_editar", "mod_tc_importar"],
    },
    {
        "name": "comercial",
        "label": "Comercial",
        "description": "Área comercial y ventas",
        "app_permissions": ["matriz", "crm"],
    },
    {
        "name": "operativo",
        "label": "Operativo",
        "description": "Operaciones logísticas",
        "app_permissions": ["matriz", "mod_operativo"],
    },
    {
        "name": "gestor_tickets",
        "label": "Gestor de Tickets",
        "description": "Supervisor/analista/coordinador — gestiona en Operativo los tickets de ZymoAlly asignados a su nombre",
        "app_permissions": ["matriz", "mod_operativo_tickets"],
    },
    {
        "name": "empleado",
        "label": "Empleado",
        "description": "Acceso básico para colaboradores",
        "app_permissions": ["matriz"],
    },
    {
        "name": "calidad",
        "label": "Gestión de Calidad",
        "description": "Administración del SGC y catálogo de proveedores",
        "app_permissions": ["mod_sgc", "matriz"],
    },
    {
        "name": "gerente",
        "label": "Gerente",
        "description": "Gerencia general — módulo gerencial (KPIs, ZYMO)",
        "app_permissions": ["mod_gerencial", "matriz"],
    },
    {
        "name": "administrativo",
        "label": "Administrativo",
        "description": "Gestión administrativa y módulo OC",
        "app_permissions": ["mod_oc_ver", "mod_oc_aprobar", "mod_oc_config", "matriz"],
    },
    {
        "name": "compras",
        "label": "Compras",
        "description": "Auxiliar de compras — gestión de solicitudes y cotizaciones",
        "app_permissions": ["mod_oc_ver", "matriz"],
    },
    {
        "name": "financiero",
        "label": "Financiero",
        "description": "Módulo de facturas y validación contable",
        "app_permissions": ["mod_financiero", "matriz"],
    },
    {
        "name": "auxiliar_mantenimiento",
        "label": "Auxiliar de Mantenimiento",
        "description": "Gestión de solicitudes de mantenimiento — sin acceso al módulo OC/Compras",
        "app_permissions": ["mod_mantenimiento"],
    },
]


def _migrate_db() -> None:
    """Agrega columnas nuevas si la tabla ya existe (migraciones ligeras)."""
    with get_engine().connect() as conn:
        # Phase 2: label fue agregado al modelo sin migración
        try:
            conn.execute(text("ALTER TABLE role ADD COLUMN label VARCHAR(100) NOT NULL DEFAULT ''"))
            conn.commit()
            print("[migrate] Columna label agregada.")
        except Exception:
            pass  # La columna ya existe
        # Phase 3: app_permissions
        try:
            conn.execute(text("ALTER TABLE role ADD COLUMN app_permissions JSON"))
            conn.commit()
            print("[migrate] Columna app_permissions agregada.")
        except Exception:
            pass  # La columna ya existe
        try:
            conn.execute(
                text(
                    "ALTER TABLE sede ADD COLUMN visible_en_solicitudes_oc "
                    "INTEGER NOT NULL DEFAULT 1",
                ),
            )
            conn.commit()
            print("[migrate] Columna sede.visible_en_solicitudes_oc agregada.")
        except Exception:
            pass
    with Session(get_engine()) as session:
        for sede_row in session.exec(select(Sede)).all():
            if sede_row.name.strip().lower() == "transversal":
                sede_row.visible_en_solicitudes_oc = False
                session.add(sede_row)
        session.commit()
    _resync_pg_sequences()


# Tablas con PK entero autoincremental migradas desde SQLite (ver
# backend/scripts/migrate_intranet.py) — form_drafts queda fuera porque su
# id es texto (UUID), no serial.
_TABLES_WITH_SERIAL_ID = [
    "area", "sede", "role", "user", "user_tools",
    "learned_synonyms", "extraction_reviews",
]


def _resync_pg_sequences() -> None:
    """Autorepara secuencias de PostgreSQL desincronizadas tras una migración
    de datos con id explícito (ver incidente 2026-07-07: crear usuarios
    fallaba con UniqueViolation porque user_id_seq se quedó en 1 tras migrar
    intranet.db). Idempotente y sin efecto si las secuencias ya están al día.
    """
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return  # setval/pg_get_serial_sequence no aplican a SQLite (dev local)
    with engine.connect() as conn:
        for table in _TABLES_WITH_SERIAL_ID:
            try:
                conn.execute(
                    text(
                        f'SELECT setval('
                        f"pg_get_serial_sequence('{table}', 'id'), "
                        f'COALESCE((SELECT MAX(id) FROM "{table}"), 1), '
                        f'(SELECT MAX(id) IS NOT NULL FROM "{table}"))'
                    )
                )
                conn.commit()
            except Exception as exc:
                print(f"[migrate] No se pudo resincronizar la secuencia de {table}: {exc}")


def _seed_roles() -> None:
    with Session(get_engine()) as session:
        for r in _DEFAULT_ROLES:
            existing = session.exec(select(Role).where(Role.name == r["name"])).first()
            if not existing:
                session.add(Role(**r))
            else:
                changed = False
                if not existing.label:  # vacío por el DEFAULT '' de la migración
                    existing.label = r["label"]
                    changed = True
                # Repoblar desde plantilla si aún no hay permisos (migración; admin puede quedar en [])
                tmpl = list(r["app_permissions"])
                if existing.app_permissions is None:
                    existing.app_permissions = tmpl
                    changed = True
                elif not existing.app_permissions and r["name"] != "admin":
                    existing.app_permissions = tmpl
                    changed = True
                if changed:
                    session.add(existing)
        session.commit()
    print("[seed] Roles verificados.")


_DEFAULT_AREAS = [
    "Comercial", "Operaciones", "Talento y Cultura", "Finanzas", "IT", "Dirección",
    "contabilidad", "Compras", "Gestión de Calidad",
]

_DEFAULT_SEDES = [
    "IMCCARGO", "LOGIMAT", "IMC Depósito",
]


def _seed_areas_sedes() -> None:
    with Session(get_engine()) as session:
        for name in _DEFAULT_AREAS:
            if not session.exec(select(Area).where(Area.name == name)).first():
                session.add(Area(name=name))
        for name in _DEFAULT_SEDES:
            if not session.exec(select(Sede).where(Sede.name == name)).first():
                session.add(Sede(name=name))
        session.commit()
    print("[seed] Áreas y sedes verificadas.")


# Semilla inicial de la rúbrica de análisis completo (MCP-001 / sig_analyze_full).
# Antes vivía hardcodeada en netvault.py — se movió a tabla (rubrica_categorias)
# para que se pueda editar desde la página "Análisis" del SIG. Estos valores solo
# se usan para poblar la tabla la primera vez; después de eso la fuente de verdad
# es la BD, no este diccionario.
_DEFAULT_RUBRICA_CATEGORIAS = [
    {
        "id": "claridad", "name": "Claridad", "weight": 1.2, "orden": 0,
        "description": "El texto es comprensible, sin ambigüedades ni jerga innecesaria.",
        "checks": [
            "Cada paso tiene un verbo de acción explícito",
            "No hay términos sin definir en el primer uso",
            "Las condiciones (si/entonces) están explícitas",
            "Un lector nuevo puede ejecutar el proceso sin preguntar",
        ],
    },
    {
        "id": "completitud", "name": "Completitud", "weight": 1.2, "orden": 1,
        "description": "Cubre inicio, desarrollo, cierre, excepciones y entregables.",
        "checks": [
            "Existe disparador claro de inicio",
            "Todos los pasos intermedios están documentados",
            "Hay cierre formal con entregables",
            "Se documentan excepciones y qué hacer ante ellas",
            "Referencias a formularios/sistemas están nombrados",
        ],
    },
    {
        "id": "responsabilidades", "name": "Responsabilidades", "weight": 1.0, "orden": 2,
        "description": "Define quién hace qué, con roles y escalamiento.",
        "checks": [
            "Cada actividad tiene responsable (rol o cargo)",
            "Existe escalamiento ante bloqueos",
            "Aprobaciones tienen autoridad nombrada",
            "No hay pasos huérfanos sin dueño",
        ],
    },
    {
        "id": "riesgos", "name": "Riesgos", "weight": 1.0, "orden": 3,
        "description": "Identifica riesgos operacionales, legales y de cumplimiento.",
        "checks": [
            "Riesgos por paso o por fase están nombrados",
            "Existen controles o mitigaciones",
            "Datos sensibles tienen manejo indicado",
            "Impacto de error está considerado",
        ],
    },
    {
        "id": "tiempos", "name": "Tiempos", "weight": 0.8, "orden": 4,
        "description": "Plazos, SLAs y duración por actividad cuando aplique.",
        "checks": [
            "Actividades con SLA o plazo tienen valor numérico",
            "Unidades de tiempo son consistentes",
            "Tiempos de espera entre áreas están indicados",
            "Plazos legales o contractuales están citados si aplican",
        ],
    },
    {
        "id": "cumplimiento", "name": "Cumplimiento", "weight": 1.0, "orden": 5,
        "description": "Alineación con normativa interna, políticas y trazabilidad.",
        "checks": [
            "Referencia a políticas o normas internas cuando aplica",
            "Registros/evidencias de cumplimiento están definidos",
            "Versionado y vigencia del documento son coherentes",
            "Separación de funciones en aprobaciones sensibles",
        ],
    },
    {
        "id": "mejora_continua", "name": "Mejora continua", "weight": 0.8, "orden": 6,
        "description": "Oportunidades de automatización, eliminación de pasos y mejoras.",
        "checks": [
            "Pasos manuales redundantes identificados",
            "Oportunidades de integración con intranet/sistemas",
            "Métricas o KPIs del proceso mencionados o sugeridos",
            "Propuestas son accionables y priorizadas",
        ],
    },
]


def _seed_rubrica() -> None:
    """Idempotente por clave natural (id de categoría), no por conteo — si ya
    existe una fila con ese id no se toca (puede tener ediciones del usuario)."""
    with Session(get_engine()) as session:
        for cat in _DEFAULT_RUBRICA_CATEGORIAS:
            if not session.get(RubricaCategoria, cat["id"]):
                session.add(RubricaCategoria(**cat))
        session.commit()
    print("[seed] Rúbrica de análisis verificada.")


# Semilla inicial del catálogo de tipos de análisis del SIG. Antes vivía
# hardcodeado como ANALYSIS_KINDS en SigRubricaPanel.tsx — se movió a tabla
# (analysis_kinds) para que se pueda editar desde la página "Análisis" del SIG,
# igual que la rúbrica. Estos valores solo pueblan la tabla la primera vez.
#
# Corregido: coherencia/mejoras/proc-vs-inst/cargos decían "Corre en el servidor
# (Gemini de la intranet)" dando a entender que solo se ejecutan desde la
# intranet — es falso, MCP-001 expone sig_analyze_coherencia/mejoras/proc_vs_inst/
# cargos y dispara el MISMO endpoint server-side (mismo Gemini, misma key), solo
# que el disparo puede venir de Claude Code/Codex vía MCP en vez de la UI.
_DEFAULT_ANALYSIS_KINDS = [
    {
        "id": "coherencia", "name": "Coherencia", "cost": "bajo", "orden": 0,
        "description": "Revisa que el texto del procedimiento y su flujograma no se contradigan entre sí.",
        "where_text": "Corre en el servidor con Gemini — se dispara desde la intranet o desde MCP-001 (Claude Code/Codex), mismo motor y misma key en ambos casos.",
    },
    {
        "id": "mejoras", "name": "Mejoras", "cost": "bajo", "orden": 1,
        "description": "Sugiere mejoras puntuales de trazabilidad, claridad y numerales faltantes.",
        "where_text": "Corre en el servidor con Gemini — se dispara desde la intranet o desde MCP-001 (Claude Code/Codex), mismo motor y misma key en ambos casos.",
    },
    {
        "id": "proc-vs-inst", "name": "Proc/Inst", "cost": "medio", "orden": 2,
        "description": "Compara el procedimiento contra sus instructivos — busca pasos que no coinciden.",
        "where_text": "Corre en el servidor con Gemini — se dispara desde la intranet o desde MCP-001 (Claude Code/Codex), mismo motor y misma key en ambos casos.",
    },
    {
        "id": "cargos", "name": "Cargos", "cost": "medio", "orden": 3,
        "description": "Compara el procedimiento contra los manuales de funciones de T&C de los cargos involucrados.",
        "where_text": "Corre en el servidor con Gemini — se dispara desde la intranet o desde MCP-001 (Claude Code/Codex), mismo motor y misma key en ambos casos.",
    },
    {
        "id": "completo", "name": "Análisis completo", "cost": "alto", "orden": 4,
        "description": "Las 7 categorías de la rúbrica de abajo, todas a la vez — el análisis más profundo que existe hoy.",
        "where_text": "Lo ejecuta un agente externo (Claude Code/Codex, con su propia suscripción) vía MCP-001 — no gasta la key del servidor.",
    },
    {
        "id": "lightrag", "name": "LightRAG (indexar)", "cost": "bajo", "orden": 5,
        "description": "No es un análisis — indexa el procedimiento al grafo de conocimiento para que la IA lo tenga presente después.",
        "where_text": "Botón \"RAG\" dentro de cada procedimiento. Ver el resultado en Grafo de conocimiento.",
    },
]


def _seed_analysis_kinds() -> None:
    """Idempotente por clave natural (id del tipo de análisis) — si ya existe
    una fila con ese id no se toca (puede tener ediciones del usuario)."""
    with Session(get_engine()) as session:
        for kind in _DEFAULT_ANALYSIS_KINDS:
            if not session.get(AnalysisKind, kind["id"]):
                session.add(AnalysisKind(**kind))
        session.commit()
    print("[seed] Catálogo de tipos de análisis verificado.")


def _seed_admin() -> None:
    with Session(get_engine()) as session:
        existing = session.exec(
            select(User).where(User.role == "admin")
        ).first()
        if existing:
            print(f"[seed] Admin ya existe: {existing.email}")
            return
        admin = User(
            email=settings.first_admin_email,
            hashed_password=hash_password(settings.first_admin_password),
            full_name="Administrador ZYMO",
            role="admin",
            sede="IMCCARGO",
            area="IT",
        )
        session.add(admin)
        session.commit()
        print(f"[seed] Admin creado: {settings.first_admin_email}")


def _migrate_oc_db() -> None:
    """Agrega columnas nuevas a oc.db sin tocar datos existentes."""
    nuevas_columnas = [
        ("evidencia_url", "TEXT"),
        ("plataforma", "VARCHAR(100)"),
        ("numero_remision", "VARCHAR(100)"),
        ("observaciones_compras", "TEXT"),
        ("fecha_estimada_entrega", "DATE"),
        ("fecha_confirmada_entrega", "DATE"),
        ("numero_factura", "VARCHAR(100)"),
        ("aval_compra", "VARCHAR(200)"),
        ("observacion_contabilidad", "TEXT"),
        ("fecha_recibida_factura", "DATE"),
        ("fecha_asignacion", "DATETIME"),
        ("fecha_en_plataforma", "DATETIME"),
        ("tipo_solicitud", "VARCHAR(20) DEFAULT 'compra'"),
        ("tipo_mantenimiento", "VARCHAR(20)"),
        ("tiene_proforma", "BOOLEAN DEFAULT 0"),
        ("proforma_path", "TEXT"),
        ("fecha_cerrado", "DATETIME"),
        ("archivada", "BOOLEAN DEFAULT 0"),
    ]
    with get_oc_engine().connect() as conn:
        for col, tipo in nuevas_columnas:
            try:
                conn.execute(text(f"ALTER TABLE oc_solicitudes ADD COLUMN {col} {tipo}"))
                conn.commit()
                print(f"[migrate_oc] Columna {col} agregada.")
            except Exception:
                pass  # Ya existe


def _normalize_plataformas_oc() -> None:
    """Normaliza valores históricos del campo plataforma en oc_solicitudes.

    Algunas solicitudes antiguas fueron creadas con variantes de capitalización
    (logimat, Logimat, imccargo, IMC Cargo, imcdep) antes de que existiera el
    catálogo de sedes como fuente de verdad. Esta migración los deja alineados
    con los nombres canónicos de la tabla `sede`.
    """
    mapping = [
        # (valores_a_corregir, nombre_canonico)
        (("logimat", "Logimat"), "LOGIMAT"),
        (("imccargo", "IMC Cargo"), "IMCCARGO"),
        (("imcdep",), "IMC Depósito"),
    ]
    with get_oc_engine().connect() as conn:
        for variantes, canonical in mapping:
            placeholders = ", ".join(f"'{v}'" for v in variantes)
            result = conn.execute(
                text(f"SELECT COUNT(*) FROM oc_solicitudes WHERE plataforma IN ({placeholders})")
            )
            count = result.scalar() or 0
            if count:
                conn.execute(
                    text(
                        f"UPDATE oc_solicitudes SET plataforma = :canonical "
                        f"WHERE plataforma IN ({placeholders})"
                    ),
                    {"canonical": canonical},
                )
                conn.commit()
                print(f"[normalize_plataformas] '{canonical}' ← normalizados {count} registros ({', '.join(variantes)}).")


def _migrate_oc_cotizaciones() -> None:
    """Agrega columnas nuevas a oc_cotizaciones sin tocar datos existentes."""
    nuevas = [
        ("proveedor_nit", "VARCHAR(50)"),
        ("valor_antes_iva", "REAL"),
        ("valor_iva", "REAL"),
        ("forma_pago", "VARCHAR(200)"),
        ("plazo_entrega", "VARCHAR(200)"),
        ("garantia", "VARCHAR(300)"),
        ("anticipo", "VARCHAR(200)"),
        ("pago_saldo", "VARCHAR(200)"),
        ("items", "JSON"),  # lista de ítems multi-producto [{descripcion, cantidad, valor_unitario, ...}]
    ]
    with get_oc_engine().connect() as conn:
        for col, tipo in nuevas:
            try:
                conn.execute(text(f"ALTER TABLE oc_cotizaciones ADD COLUMN {col} {tipo}"))
                conn.commit()
                print(f"[migrate_oc_cot] Columna {col} agregada.")
            except Exception:
                pass
        # Renombrar fecha_vigencia → fecha_estimada_entrega (SQLite 3.25+)
        try:
            conn.execute(text(
                "ALTER TABLE oc_cotizaciones RENAME COLUMN fecha_vigencia TO fecha_estimada_entrega"
            ))
            conn.commit()
            print("[migrate_oc_cot] Columna fecha_vigencia renombrada a fecha_estimada_entrega.")
        except Exception:
            pass  # Ya renombrada o columna no existía


_log = logging.getLogger("zymo.scheduler")


def _job_limpiar_borradores() -> None:
    """Job APScheduler: delega la purga de borradores al servicio correspondiente."""
    try:
        with Session(get_engine()) as db:
            from app.services.draft_service import purge_old_drafts
            purge_old_drafts(db, ttl_days=settings.draft_ttl_days)
    except Exception as exc:  # pragma: no cover
        _log.error("[borradores] Error en limpieza automática: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validar que credenciales críticas estén configuradas
    if not settings.first_admin_password:
        raise RuntimeError(
            "FIRST_ADMIN_PASSWORD no está configurada en el entorno. "
            "Agrégala al archivo .env antes de arrancar."
        )
    create_db_and_tables()
    _migrate_db()
    _seed_roles()
    _seed_areas_sedes()
    _seed_rubrica()
    _seed_analysis_kinds()
    _seed_admin()
    create_oc_tables()
    _migrate_oc_db()
    _migrate_oc_cotizaciones()
    _normalize_plataformas_oc()
    create_sgc_tables()
    create_financiero_tables()
    create_agent_tables()
    create_gerencial_tables()
    create_personal_tables()
    from app.tc_org_seed import seed_organigrama_if_needed
    with Session(get_engine()) as _main_db:
        seed_organigrama_if_needed(_main_db)

    # ── Scheduler de limpieza de borradores ──────────────────────────────────
    scheduler = BackgroundScheduler(timezone="America/Bogota")
    scheduler.add_job(
        _job_limpiar_borradores,
        trigger="interval",
        hours=24,
        id="limpiar_borradores",
        replace_existing=True,
    )
    scheduler.start()
    _log.info("[scheduler] Job limpiar_borradores registrado (cada 24 h, TTL=%d días).", settings.draft_ttl_days)

    yield

    scheduler.shutdown(wait=False)
    _log.info("[scheduler] Scheduler detenido.")


app = FastAPI(
    title="ZYMO Intranet API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(areas_router.router)
app.include_router(sedes_router.router)
app.include_router(oc_router)
app.include_router(sgc_router)
app.include_router(financiero_router)
app.include_router(agentes_router)
app.include_router(zymo_router)
app.include_router(gerencial_router)
app.include_router(borradores_router)
app.include_router(admin_extraccion_router)
app.include_router(admin_smtp_config_router)
app.include_router(admin_whatsapp_config_router)
app.include_router(whatsapp_router)
app.include_router(user_tools_router)
app.include_router(tasks_v2_router)
app.include_router(netvault_router)
app.include_router(mantenimiento_router)
app.include_router(sig_pdf_router)
app.include_router(personal_router)
app.include_router(tc_agenda_router)
app.include_router(tc_cap_coordinador_router)
app.include_router(tc_formatos_router)
app.include_router(tc_evaluaciones_router)
app.include_router(tc_caps_router)
app.include_router(tc_aprobaciones_router)
app.include_router(tc_paquetes_router)
app.include_router(tc_clientes_router)
app.include_router(oper_clientes_router)

_TC_FOTOS_DIR = "/app/data/tc_fotos"
os.makedirs(_TC_FOTOS_DIR, exist_ok=True)
app.mount("/tc-fotos", StaticFiles(directory=_TC_FOTOS_DIR), name="tc_fotos")

_TC_MANUALES_DIR = "/app/data/tc_manuales"
os.makedirs(_TC_MANUALES_DIR, exist_ok=True)
app.mount("/tc-manuales", StaticFiles(directory=_TC_MANUALES_DIR), name="tc_manuales")

_TC_DOCS_DIR = "/app/data/tc_docs"
os.makedirs(_TC_DOCS_DIR, exist_ok=True)
app.mount("/tc-docs", StaticFiles(directory=_TC_DOCS_DIR), name="tc_docs")

# Logos de plataforma para correos OC — antes se incrustaban base64 en el HTML
# (penalizado por filtros de spam), ahora se sirven como archivo real.
_OC_LOGOS_DIR = os.path.join(os.path.dirname(__file__), "platforms")
if os.path.isdir(_OC_LOGOS_DIR):
    app.mount("/oc-logos", StaticFiles(directory=_OC_LOGOS_DIR), name="oc_logos")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import logging as _logging
    _logging.getLogger("uvicorn.error").error(
        "422 Validation error on %s %s — %s",
        request.method, request.url.path, exc.errors()
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/health")
def health():
    return {"status": "ok"}


