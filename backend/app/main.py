import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from app.routers.borradores import router as borradores_router
from app.routers.admin.extraccion import router as admin_extraccion_router
from app.routers.herramientas_tareas import router as herramientas_tareas_router
from app.routers.tasks_v2 import router as tasks_v2_router
from app.routers.netvault import router as netvault_router
from app.routers.mantenimiento.router import router as mantenimiento_router
from app.models.mantenimiento import SolicitudMantenimiento, TipoMantenimientoConfig, HistorialMantenimiento  # noqa: F401


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
        "app_permissions": ["matriz"],
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
        # task_team_members.role (agregada en feat multi-workspace)
        try:
            conn.execute(text("ALTER TABLE task_team_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'"))
            conn.commit()
            print("[migrate] Columna task_team_members.role agregada.")
        except Exception:
            pass  # ya existe
        # task_events.owner_user_id (reemplaza scope en feat multi-workspace)
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN owner_user_id INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna task_events.owner_user_id agregada.")
        except Exception:
            pass  # ya existe
        # task_events.team_id (opcional, puede ser NULL)
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN team_id INTEGER"))
            conn.commit()
            print("[migrate] Columna task_events.team_id agregada.")
        except Exception:
            pass  # ya existe
        # task_events.plataforma (agregada para formulario del calendario)
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN plataforma VARCHAR(50)"))
            conn.commit()
            print("[migrate] Columna task_events.plataforma agregada.")
        except Exception:
            pass  # ya existe
        # task_teams: eliminar restriccion NOT NULL de scope (SQLite no soporta ALTER COLUMN,
        # se recrea la tabla copiando datos sin la columna scope).
        # Se desactivan FK temporalmente para evitar error al hacer DROP en SQLite.
        try:
            result = conn.execute(text("PRAGMA table_info(task_teams)"))
            columns = [row[1] for row in result.fetchall()]
            if "scope" in columns:
                conn.execute(text("PRAGMA foreign_keys = OFF"))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS task_teams_new (
                        id INTEGER PRIMARY KEY,
                        owner_user_id INTEGER NOT NULL,
                        name VARCHAR(150) NOT NULL,
                        is_active INTEGER NOT NULL DEFAULT 1,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL
                    )
                """))
                conn.execute(text("""
                    INSERT INTO task_teams_new (id, owner_user_id, name, is_active, created_at, updated_at)
                    SELECT id, owner_user_id, name, is_active, created_at, updated_at
                    FROM task_teams
                    WHERE owner_user_id IS NOT NULL
                """))
                conn.execute(text("DROP TABLE task_teams"))
                conn.execute(text("ALTER TABLE task_teams_new RENAME TO task_teams"))
                conn.execute(text("PRAGMA foreign_keys = ON"))
                conn.commit()
                print("[migrate] Tabla task_teams recreada sin columna scope.")
        except Exception as e:
            print(f"[migrate] task_teams ya estaba limpia o error: {e}")
        # task_events: eliminar columna scope (reemplazada por owner_user_id en multi-workspace).
        # También corrige filas con owner_user_id = 0 usando creado_por_id como fallback.
        try:
            result = conn.execute(text("PRAGMA table_info(task_events)"))
            columns = [row[1] for row in result.fetchall()]
            if "scope" in columns:
                conn.execute(text("PRAGMA foreign_keys = OFF"))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS task_events_new (
                        id INTEGER PRIMARY KEY,
                        owner_user_id INTEGER NOT NULL,
                        team_id INTEGER,
                        titulo VARCHAR(250) NOT NULL,
                        descripcion TEXT,
                        plataforma VARCHAR(50),
                        fecha DATE NOT NULL,
                        hora_inicio VARCHAR(5) NOT NULL,
                        duracion_minutos INTEGER NOT NULL DEFAULT 60,
                        creado_por_id INTEGER NOT NULL,
                        creado_por_nombre VARCHAR(200) NOT NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL
                    )
                """))
                conn.execute(text("""
                    INSERT INTO task_events_new (
                        id, owner_user_id, team_id, titulo, descripcion, plataforma,
                        fecha, hora_inicio, duracion_minutos,
                        creado_por_id, creado_por_nombre, created_at, updated_at
                    )
                    SELECT
                        id,
                        CASE WHEN owner_user_id IS NULL OR owner_user_id = 0
                             THEN creado_por_id ELSE owner_user_id END,
                        team_id, titulo, descripcion, plataforma,
                        fecha, hora_inicio, duracion_minutos,
                        creado_por_id, creado_por_nombre, created_at, updated_at
                    FROM task_events
                """))
                conn.execute(text("DROP TABLE task_events"))
                conn.execute(text("ALTER TABLE task_events_new RENAME TO task_events"))
                conn.execute(text("PRAGMA foreign_keys = ON"))
                conn.commit()
                print("[migrate] Tabla task_events recreada sin columna scope.")
        except Exception as e:
            print(f"[migrate] task_events ya estaba limpia o error: {e}")
        # work_tasks.scope: restaurar si falta — la tabla pudo migrarse quitando scope (feat revertido).
        try:
            result = conn.execute(text("PRAGMA table_info(work_tasks)"))
            columns = [row[1] for row in result.fetchall()]
            if columns and "scope" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE work_tasks ADD COLUMN scope "
                        "VARCHAR(100) NOT NULL DEFAULT 'desarrollo_innovacion'",
                    ),
                )
                conn.commit()
                print("[migrate] Columna work_tasks.scope restaurada.")
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_work_tasks_scope ON work_tasks(scope)"))
                conn.commit()
        except Exception as e:
            print(f"[migrate] work_tasks.scope: {e}")
        # work_tasks.prioridad (feat gestion-tareas-v2)
        try:
            conn.execute(text(
                "ALTER TABLE work_tasks ADD COLUMN prioridad VARCHAR(10) NOT NULL DEFAULT 'media'"
            ))
            conn.commit()
            print("[migrate] Columna work_tasks.prioridad agregada.")
        except Exception:
            pass  # ya existe
        # task_list_configs: is_final, is_canceled
        try:
            conn.execute(text("ALTER TABLE task_list_configs ADD COLUMN is_final INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna task_list_configs.is_final agregada.")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE task_list_configs ADD COLUMN is_canceled INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna task_list_configs.is_canceled agregada.")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE task_list_configs ADD COLUMN is_initial_assignment INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna task_list_configs.is_initial_assignment agregada.")
        except Exception:
            pass

        # Ensure 'sin_iniciar' exists in task_list_configs for all owners who have seeded configs
        try:
            result = conn.execute(text("SELECT DISTINCT owner_user_id FROM task_list_configs"))
            owners = [row[0] for row in result.fetchall()]
            for owner in owners:
                exists = conn.execute(text(
                    "SELECT 1 FROM task_list_configs "
                    "WHERE owner_user_id = :owner AND list_type = 'estado' AND value = 'sin_iniciar'"
                ), {"owner": owner}).fetchone()
                if not exists:
                    has_initial = conn.execute(text(
                        "SELECT 1 FROM task_list_configs "
                        "WHERE owner_user_id = :owner AND list_type = 'estado' AND is_initial_assignment = 1"
                    ), {"owner": owner}).fetchone()
                    is_initial = 1 if not has_initial else 0
                    conn.execute(text(
                        "INSERT INTO task_list_configs "
                        "(owner_user_id, list_type, value, label, is_active, is_final, is_canceled, is_initial_assignment, created_at, updated_at) "
                        "VALUES (:owner, 'estado', 'sin_iniciar', 'Sin iniciar', 1, 0, 0, :is_initial, :now, :now)"
                    ), {
                        "owner": owner,
                        "is_initial": is_initial,
                        "now": datetime.now(timezone.utc)
                    })
                    conn.commit()
                    print(f"[migrate] 'sin_iniciar' added for owner {owner} (is_initial={is_initial}).")
        except Exception as e:
            print(f"[migrate] Error updating task_list_configs states: {e}")

        # Ensure default etiquetas and plataformas exist for all owners
        _DEFAULT_MISSING = [
            ("etiqueta",   "desarrollos",        "Desarrollos"),
            ("etiqueta",   "actualizaciones",    "Actualizaciones"),
            ("etiqueta",   "auditorias",         "Auditorías"),
            ("etiqueta",   "implementacion_okr", "Implementación OKR"),
            ("etiqueta",   "tareas_diarias",     "Tareas diarias"),
            ("plataforma", "logimat1",           "Logimat 1"),
            ("plataforma", "logimat2",           "Logimat 2"),
            ("plataforma", "imccargo",           "IMC Cargo"),
            ("plataforma", "imcdeposito",        "IMC Depósito"),
            ("plataforma", "transversal",        "Transversal"),
        ]
        try:
            result = conn.execute(text("SELECT DISTINCT owner_user_id FROM task_list_configs"))
            owners = [row[0] for row in result.fetchall()]
            for owner in owners:
                for list_type, value, label in _DEFAULT_MISSING:
                    exists = conn.execute(text(
                        "SELECT 1 FROM task_list_configs "
                        "WHERE owner_user_id = :owner AND list_type = :lt AND value = :val"
                    ), {"owner": owner, "lt": list_type, "val": value}).fetchone()
                    if not exists:
                        conn.execute(text(
                            "INSERT INTO task_list_configs "
                            "(owner_user_id, list_type, value, label, is_active, is_final, is_canceled, is_initial_assignment, created_at, updated_at) "
                            "VALUES (:owner, :lt, :val, :label, 1, 0, 0, 0, :now, :now)"
                        ), {"owner": owner, "lt": list_type, "val": value, "label": label, "now": datetime.now(timezone.utc)})
                        conn.commit()
                        print(f"[migrate] '{value}' ({list_type}) added for owner {owner}.")
        except Exception as e:
            print(f"[migrate] Error inserting missing default list items: {e}")

        # Ensure 'completada' is marked is_final = 1
        try:
            conn.execute(text(
                "UPDATE task_list_configs SET is_final = 1 "
                "WHERE list_type = 'estado' AND value = 'completada' AND is_final = 0"
            ))
            conn.commit()
            print("[migrate] is_final updated to 1 for value='completada'.")
        except Exception as e:
            print(f"[migrate] Error updating is_final for completed tasks: {e}")

        # task_events: prioridad
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN prioridad VARCHAR(50)"))
            conn.commit()
            print("[migrate] Columna task_events.prioridad agregada.")
        except Exception:
            pass
        # work_tasks: asignado_a_id, asignado_a_nombre (feat adjuntos y asignación)
        try:
            conn.execute(text("ALTER TABLE work_tasks ADD COLUMN asignado_a_id INTEGER"))
            conn.commit()
            print("[migrate] Columna work_tasks.asignado_a_id agregada.")
        except Exception:
            pass  # ya existe
        try:
            conn.execute(text(
                "ALTER TABLE work_tasks ADD COLUMN asignado_a_nombre VARCHAR(200) NOT NULL DEFAULT ''"
            ))
            conn.commit()
            print("[migrate] Columna work_tasks.asignado_a_nombre agregada.")
        except Exception:
            pass  # ya existe
        # F1: modalidad y sede en eventos
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN modalidad VARCHAR(20)"))
            conn.commit()
            print("[migrate] Columna task_events.modalidad agregada.")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN sede VARCHAR(200)"))
            conn.commit()
            print("[migrate] Columna task_events.sede agregada.")
        except Exception:
            pass
        # F3: tiempo estimado en tareas
        try:
            conn.execute(text("ALTER TABLE work_tasks ADD COLUMN duracion_estimada_minutos INTEGER"))
            conn.commit()
            print("[migrate] Columna work_tasks.duracion_estimada_minutos agregada.")
        except Exception:
            pass
        # F4: confirmacion de asistencia en participantes de eventos
        try:
            conn.execute(text(
                "ALTER TABLE task_event_participants ADD COLUMN confirmacion VARCHAR(20) DEFAULT 'pendiente'"
            ))
            conn.commit()
            print("[migrate] Columna task_event_participants.confirmacion agregada.")
        except Exception:
            pass
        # F5: aceptacion de tarea por el asignado
        try:
            conn.execute(text("ALTER TABLE work_tasks ADD COLUMN aceptacion VARCHAR(20)"))
            conn.commit()
            print("[migrate] Columna work_tasks.aceptacion agregada.")
        except Exception:
            pass
    with Session(get_engine()) as session:
        for sede_row in session.exec(select(Sede)).all():
            if sede_row.name.strip().lower() == "transversal":
                sede_row.visible_en_solicitudes_oc = False
                session.add(sede_row)
        session.commit()


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
    _seed_admin()
    create_oc_tables()
    _migrate_oc_db()
    _migrate_oc_cotizaciones()
    _normalize_plataformas_oc()
    create_sgc_tables()
    create_financiero_tables()
    create_agent_tables()
    create_gerencial_tables()

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
app.include_router(herramientas_tareas_router)
app.include_router(tasks_v2_router)
app.include_router(netvault_router)
app.include_router(mantenimiento_router)


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
