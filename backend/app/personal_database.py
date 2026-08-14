"""
Base de datos del módulo T&C (Talento y Cultura) — Personal.

Tablas: ptc_area, ptc_cargo, ptc_cargo_sede, ptc_persona,
        ptc_capacitacion, ptc_evaluacion, ptc_sancion, ptc_novedad

Las empresas/compañías ya NO están en este módulo. Se leen de la tabla
Sede del backend principal. ptc_persona.sede_id referencia Sede.id sin FK
(cross-DB, SQLite → PostgreSQL).
"""
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel, Session, create_engine

from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_personal_engine = None


def get_personal_engine():
    global _personal_engine
    if _personal_engine is None:
        url = settings.personal_database_url
        connect_args = {}
        if "sqlite" in url.lower():
            ensure_sqlite_parent_dir(url)
            connect_args = {"check_same_thread": False}
        _personal_engine = create_engine(url, connect_args=connect_args)
    return _personal_engine


def get_personal_db():
    with Session(get_personal_engine()) as session:
        yield session


# ── Modelos ────────────────────────────────────────────────────────────────────

class PtcArea(SQLModel, table=True):
    __tablename__ = "ptc_area"

    id: Optional[int] = Field(default=None, primary_key=True)
    empresa_id: int = Field(default=0)  # deprecated — referenciaba ptc_empresa (eliminado)
    nombre: str = Field(max_length=100)


class PtcCargo(SQLModel, table=True):
    __tablename__ = "ptc_cargo"

    id: Optional[int] = Field(default=None, primary_key=True)
    area_id: Optional[int] = Field(default=None)  # referencia a Area principal (app.models.area)
    nombre: str = Field(max_length=150)
    parent_id: Optional[int] = Field(default=None)
    en_organigrama: bool = Field(default=False)
    org_context: str = Field(default="", max_length=40, index=True)
    org_key: str = Field(default="", max_length=80, index=True)
    org_number: str = Field(default="", max_length=30)
    org_image_url: str = Field(default="", max_length=500)
    org_pos_x: Optional[float] = Field(default=None)
    org_pos_y: Optional[float] = Field(default=None)
    manual_url: str = Field(default="", max_length=500)
    manual_filename: str = Field(default="", max_length=300)
    manual_text: str = Field(default="", sa_column_kwargs={"server_default": ""})


class PtcCargoSede(SQLModel, table=True):
    __tablename__ = "ptc_cargo_sede"

    cargo_id: int = Field(primary_key=True)
    sede_id: int = Field(primary_key=True)


class PtcPersona(SQLModel, table=True):
    __tablename__ = "ptc_persona"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Identificación
    nombre: str = Field(max_length=150)
    initials: str = Field(max_length=5, default="")
    documento: str = Field(max_length=30, default="")

    # Organización — sede_id referencia Sede.id del backend principal (sin FK, cross-DB)
    sede_id: int = Field(default=0)
    area_id: Optional[int] = Field(default=None)
    cargo_id: Optional[int] = Field(default=None, foreign_key="ptc_cargo.id")

    # Datos personales
    genero: str = Field(max_length=20, default="")
    rh: str = Field(max_length=10, default="")
    tarjeta: str = Field(max_length=200, default="")  # carné(s) de acceso a instalaciones
    tarjeta_fecha_asignacion: Optional[date] = None  # trazabilidad de reasignación de carné
    email: str = Field(max_length=150, default="")
    email_corporativo: str = Field(max_length=150, default="")
    telefono: str = Field(max_length=30, default="")
    telefono_corporativo: str = Field(max_length=30, default="")
    foto_url: str = Field(max_length=500, default="")
    firma_url: str = Field(max_length=500, default="")
    fecha_nacimiento: Optional[date] = None
    edad: Optional[int] = None

    # Contrato
    tipo_contrato: str = Field(max_length=80, default="Término indefinido")
    fecha_ingreso: Optional[date] = None
    antiguedad_label: str = Field(max_length=50, default="")
    estado: str = Field(max_length=20, default="Activo")
    tipo_salida: str = Field(max_length=80, default="")
    fecha_salida: Optional[date] = None

    # Desarrollo
    idp_active: bool = False
    idp_eligible: bool = True
    score: int = Field(default=0)  # 0-100 potencial de ascenso

    # Vínculo con intranet (nullable — no todos tienen login)
    user_id: Optional[int] = None

    # Jefe directo explícito (self-referencing) — separado del organigrama de
    # cargos (PtcCargo.parent_id) porque un cargo puede tener varias personas,
    # lo que hace ambiguo derivar "el" jefe de alguien caminando cargos. Este
    # campo siempre resuelve a una sola persona, sin ambigüedad. Usado para
    # resolver jerarquía analista→coordinador→supervisor (Zymo Ally tickets)
    # y cualquier otro flujo futuro que necesite "quién es el jefe de X".
    jefe_directo_id: Optional[int] = Field(default=None, foreign_key="ptc_persona.id")

    # Trazabilidad
    legacy_id: str = Field(max_length=80, default="", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PtcCapacitacion(SQLModel, table=True):
    __tablename__ = "ptc_capacitacion"

    id: Optional[int] = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id")
    titulo: str = Field(max_length=200)
    fecha: Optional[date] = None
    horas: Optional[float] = None
    estado: str = Field(max_length=30, default="Completado")
    tipo: str = Field(max_length=20, default="Interna")  # "Interna" | "Externa"
    costo: Optional[float] = None
    diploma_url: str = Field(max_length=500, default="")
    observaciones: str = Field(max_length=500, default="")
    documentos: str = Field(default="[]")  # ponytail: JSON [{nombre,url}], upgrade to table if attachments needed
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcEvaluacion(SQLModel, table=True):
    __tablename__ = "ptc_evaluacion"

    id: Optional[int] = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id")
    titulo: str = Field(max_length=200)
    puntaje: Optional[float] = None  # 0–5
    cumple_meta: bool = False
    fecha: Optional[date] = None
    observaciones: str = Field(max_length=500, default="")
    # "manual" (registrado a mano desde el perfil) o "formato:<slug>" (generado
    # al diligenciar un formato digital, ej. "formato:ausentismo").
    origen: str = Field(max_length=60, default="manual")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcEvaluacionDesempeno(SQLModel, table=True):
    """Evaluación de desempeño semestral — dos rúbricas (operativo/líderes),
    ambas con el mismo esquema de 6 competencias ponderadas 20/20/20/20/10/10
    (ver frontend/src/lib/evaluacionDesempenoRubricas.ts). El detalle completo
    por ítem vive acá para auditoría/exportación; el resumen se refleja además
    en PtcEvaluacion (perfil) con origen "formato:evaluacion_<tipo>"."""
    __tablename__ = "ptc_evaluacion_desempeno"

    id: Optional[int] = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id")
    evaluador_persona_id: int = Field(foreign_key="ptc_persona.id")
    tipo: str = Field(max_length=20)  # "operativo" | "lideres"
    periodo: str = Field(max_length=20)  # "1er semestre" | "2do semestre"
    anio: int
    respuestas: str = Field(default="[]")   # JSON [{categoria, item, texto, valor}]
    categorias: str = Field(default="[]")   # JSON [{nombre, peso, puntaje, total}]
    puntaje_total: float = 0.0
    resultado: str = Field(max_length=30, default="")
    accion_mejora: str = Field(default="", max_length=1000)
    observaciones_lider: str = Field(default="", max_length=2000)
    observaciones_liderado: str = Field(default="", max_length=2000)
    firma_lider_url: str = Field(default="", max_length=500)
    firma_liderado_url: str = Field(default="", max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcSancion(SQLModel, table=True):
    __tablename__ = "ptc_sancion"

    id: Optional[int] = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id")
    tipo: str = Field(max_length=80, default="Llamado de atención")
    descripcion: str = Field(max_length=1000, default="")
    fecha: Optional[date] = None
    origen: str = Field(max_length=60, default="manual")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcNovedad(SQLModel, table=True):
    __tablename__ = "ptc_novedad"

    id: Optional[int] = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id")
    tipo: str = Field(max_length=80, default="Permiso remunerado")
    descripcion: str = Field(max_length=1000, default="")
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: str = Field(max_length=30, default="Pendiente")
    origen: str = Field(max_length=60, default="manual")
    # Aprobación del jefe directo (ver tc_aprobaciones.py) — firma_aprobador_url
    # es un snapshot al momento de aprobar, no una referencia viva al perfil del
    # jefe, mismo patrón que firma_lider_url en PtcEvaluacionDesempeno.
    aprobador_persona_id: Optional[int] = Field(default=None, foreign_key="ptc_persona.id")
    firma_aprobador_url: str = Field(max_length=500, default="")
    aprobado_en: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcEvento(SQLModel, table=True):
    """Agenda T&C — tipo #1: inducción, agendada por el líder de un área.
    area_id se auto-resuelve del perfil del líder que agenda, no se elige a mano."""
    __tablename__ = "ptc_evento"

    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str = Field(max_length=200)
    tipo: str = Field(max_length=40, default="induccion")  # único tipo soportado por ahora
    # Interna | Externa — no confundir con "tipo" de arriba (categoría de evento).
    # Es la clasificación de la capacitación misma; se refleja en el registro
    # (ptc_capacitacion.tipo/costo) vía _sync_capacitacion en tc_agenda.py.
    modalidad: str = Field(max_length=20, default="Interna")
    costo: Optional[float] = None
    fecha: date
    hora_inicio: str = Field(max_length=10, default="08:00")  # "HH:MM"
    hora_fin: str = Field(max_length=10, default="09:00")
    descripcion: str = Field(max_length=2000, default="")
    area_id: int                                  # auto-resuelto del líder, ver tc_agenda.py
    sede_id: Optional[int] = Field(default=None)   # plataforma del líder — Sede (Postgres), sin FK; para el acta
    # Evidencia de la capacitación dictada — foto opcional, o acta firmada físicamente y reescaneada.
    foto_evidencia_url: str = Field(default="")
    acta_firmada_url: str = Field(default="")
    # Estado (Agendada/En curso/Finalizada) se calcula, no se guarda — ver
    # _calcular_estado en tc_agenda.py. Lo único que sí se persiste es el
    # momento en que el líder la marcó finalizada (None = aún no).
    finalizada_en: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PtcEventoPersona(SQLModel, table=True):
    """Personas asignadas a un evento de agenda."""
    __tablename__ = "ptc_evento_persona"

    evento_id: int = Field(foreign_key="ptc_evento.id", primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id", primary_key=True)
    asistio: Optional[bool] = None


class PtcCapDia(SQLModel, table=True):
    """Agenda T&C — tipo #2: capacitación de nuevo personal, agendada por el
    coordinador de T&C (mod_tc_cap_coordinador). Un día agrupa uno o más
    bloques (líder + horario); el roster y la evidencia viven por bloque,
    no en el día — ver PtcCapBloque/PtcCapBloquePersona."""
    __tablename__ = "ptc_cap_dia"

    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: date
    titulo: str = Field(max_length=200, default="Inducción nuevo personal")
    descripcion: str = Field(max_length=2000, default="")
    sede_id: Optional[int] = Field(default=None)  # plataforma donde se realiza — Sede (Postgres), sin FK
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcCapBloque(SQLModel, table=True):
    """Bloque líder+horario dentro de un día de capacitación (tipo #2) —
    equivalente a una franja de Teams: un líder dicta de hora_inicio a hora_fin."""
    __tablename__ = "ptc_cap_bloque"

    id: Optional[int] = Field(default=None, primary_key=True)
    dia_id: int = Field(foreign_key="ptc_cap_dia.id")
    lider_persona_id: int = Field(foreign_key="ptc_persona.id")
    hora_inicio: str = Field(max_length=10, default="08:00")
    hora_fin: str = Field(max_length=10, default="09:00")
    foto_evidencia_url: str = Field(default="")
    acta_firmada_url: str = Field(default="")
    finalizada_en: Optional[datetime] = None


class PtcCapBloquePersona(SQLModel, table=True):
    """Roster por bloque. Por default toda persona del día queda incluida en
    todos los bloques (incluido=True) — el coordinador desmarca puntualmente
    a quien no aplique a ese bloque específico, sin borrar el registro."""
    __tablename__ = "ptc_cap_bloque_persona"

    bloque_id: int = Field(foreign_key="ptc_cap_bloque.id", primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id", primary_key=True)
    incluido: bool = Field(default=True)
    asistio: Optional[bool] = None


class PtcPaquete(SQLModel, table=True):
    """Paquete de capacitaciones — plantilla reutilizable de cursos para inducción."""
    __tablename__ = "ptc_paquete"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=200)
    descripcion: str = Field(default="", max_length=500)
    activo: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PtcPaqueteItem(SQLModel, table=True):
    __tablename__ = "ptc_paquete_item"

    id: Optional[int] = Field(default=None, primary_key=True)
    paquete_id: int = Field(foreign_key="ptc_paquete.id")
    titulo: str = Field(max_length=200)
    horas: Optional[float] = None
    orden: int = Field(default=0)


class PtcSmtpConfig(SQLModel, table=True):
    """Configuración SMTP para notificaciones por email — fila única (id=1)."""
    __tablename__ = "ptc_smtp_config"

    id: int = Field(default=1, primary_key=True)
    host: str = Field(default="", max_length=200)
    port: int = Field(default=587)
    usuario: str = Field(default="", max_length=200)
    password: str = Field(default="", max_length=500)
    from_email: str = Field(default="", max_length=200)
    from_nombre: str = Field(default="T&C Zymo", max_length=100)
    activo: bool = Field(default=False)


class PtcWaConfig(SQLModel, table=True):
    """Configuración WhatsApp Business API — fila única (id=1)."""
    __tablename__ = "ptc_wa_config"

    id: int = Field(default=1, primary_key=True)
    phone_number_id: str = Field(default="", max_length=100)
    token: str = Field(default="", max_length=500)
    activo: bool = Field(default=False)


class PtcCliente(SQLModel, table=True):
    __tablename__ = "ptc_cliente"

    id: Optional[int] = Field(default=None, primary_key=True)
    client_no: str = Field(max_length=50, default="", index=True)
    dume_no: str = Field(max_length=50, default="")
    nombre: str = Field(max_length=200)
    activo: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PtcClienteAsignacion(SQLModel, table=True):
    __tablename__ = "ptc_cliente_asignacion"

    cliente_id: int = Field(foreign_key="ptc_cliente.id", primary_key=True)
    sede_id: int = Field(primary_key=True)
    persona_id: Optional[int] = Field(default=None, foreign_key="ptc_persona.id")


class PtcTicketRol(SQLModel, table=True):
    """Curación de quién puede aparecer como Supervisor/Analista/Coordinador en
    el formulario de tickets (Zymo Ally) — solo personas con cargo asignado,
    elegidas por área desde Configuración de Tickets. `rol` es texto libre
    ("supervisor" | "analista" | "coordinador") en vez de un tercer modelo por
    rol, para no triplicar la tabla."""

    __tablename__ = "ptc_ticket_rol"

    id: Optional[int] = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="ptc_persona.id")
    rol: str = Field(max_length=20)


class PtcClienteAnalista(SQLModel, table=True):
    """Analistas responsables de un cliente para efectos de gestión de tickets
    (Zymo Ally) — deliberadamente separada de PtcClienteAsignacion (Cartera de
    Clientes, 1 persona por sede). Acá un cliente puede tener varios analistas
    a la vez, sin dimensión de sede — son preguntas distintas ("quién asigno
    para logística en esta sede" vs "quién atiende tickets de este cliente")."""

    __tablename__ = "ptc_cliente_analista"

    id: Optional[int] = Field(default=None, primary_key=True)
    cliente_id: int = Field(foreign_key="ptc_cliente.id")
    persona_id: int = Field(foreign_key="ptc_persona.id")


# ── Creación de tablas ─────────────────────────────────────────────────────────

_PERSONAL_TABLES = {
    "ptc_area", "ptc_cargo", "ptc_cargo_sede", "ptc_persona",
    "ptc_capacitacion", "ptc_evaluacion", "ptc_sancion", "ptc_novedad",
    "ptc_evaluacion_desempeno",
    "ptc_evento", "ptc_evento_persona",
    "ptc_cap_dia", "ptc_cap_bloque", "ptc_cap_bloque_persona",
    "ptc_paquete", "ptc_paquete_item", "ptc_smtp_config", "ptc_wa_config",
    "ptc_cliente", "ptc_cliente_asignacion", "ptc_cliente_analista", "ptc_ticket_rol",
}


def create_personal_tables() -> None:
    from app.personal_database import (  # noqa: F401
        PtcArea, PtcCargo, PtcCargoSede, PtcPersona,
        PtcCapacitacion, PtcEvaluacion, PtcSancion, PtcNovedad,
        PtcEvaluacionDesempeno,
        PtcEvento, PtcEventoPersona,
        PtcCapDia, PtcCapBloque, PtcCapBloquePersona,
        PtcPaquete, PtcPaqueteItem, PtcSmtpConfig, PtcWaConfig,
        PtcCliente, PtcClienteAsignacion, PtcClienteAnalista, PtcTicketRol,
    )
    tables = [
        SQLModel.metadata.tables[t]
        for t in _PERSONAL_TABLES
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_personal_engine(), tables=tables)
    _migrate_personal()


def _migrate_personal() -> None:
    from sqlalchemy import text
    with get_personal_engine().connect() as conn:
        for sql in [
            "ALTER TABLE ptc_cargo ADD COLUMN manual_url TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN manual_filename TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN manual_text TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN parent_id INTEGER DEFAULT NULL",
            "ALTER TABLE ptc_cargo ADD COLUMN en_organigrama INTEGER DEFAULT 0",
            # empresa_id en ptc_cargo era campo deprecado — eliminar
            "ALTER TABLE ptc_cargo DROP COLUMN empresa_id",
            # renombrar empresa_id → sede_id en ptc_persona (empresas vienen de Sede)
            "ALTER TABLE ptc_persona RENAME COLUMN empresa_id TO sede_id",
            # score de ascenso
            "ALTER TABLE ptc_persona ADD COLUMN score INTEGER DEFAULT 0",
            "ALTER TABLE ptc_capacitacion ADD COLUMN documentos TEXT DEFAULT '[]'",
            "ALTER TABLE ptc_persona ADD COLUMN fecha_nacimiento DATE DEFAULT NULL",
            "ALTER TABLE ptc_persona ADD COLUMN edad INTEGER DEFAULT NULL",
            "ALTER TABLE ptc_cargo ADD COLUMN org_context TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN org_key TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN org_number TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN org_image_url TEXT DEFAULT ''",
            "ALTER TABLE ptc_cargo ADD COLUMN org_pos_x REAL DEFAULT NULL",
            "ALTER TABLE ptc_cargo ADD COLUMN org_pos_y REAL DEFAULT NULL",
            "ALTER TABLE ptc_persona ADD COLUMN jefe_directo_id INTEGER DEFAULT NULL",
            # ptc_evento ya existía de una versión anterior de Agenda (borrada y
            # reconstruida) — create_all() no altera tablas ya existentes, así
            # que las columnas nuevas de "tipo #1" hay que agregarlas a mano.
            "ALTER TABLE ptc_evento ADD COLUMN foto_evidencia_url TEXT DEFAULT ''",
            "ALTER TABLE ptc_evento ADD COLUMN acta_firmada_url TEXT DEFAULT ''",
            # columnas de la versión anterior de Agenda, ya no están en el modelo —
            # "lugar" quedó NOT NULL sin default físico y tumbaba todo INSERT.
            "ALTER TABLE ptc_evento DROP COLUMN lugar",
            "ALTER TABLE ptc_evento DROP COLUMN estado",
            "ALTER TABLE ptc_evento DROP COLUMN notificacion_enviada",
            # Teams se quita por ahora (2026-07-22) — columnas físicas quedan
            # huérfanas, inofensivo (SQLAlchemy solo lee columnas del modelo).
            "ALTER TABLE ptc_evento ADD COLUMN finalizada_en TEXT DEFAULT NULL",
            # tipo #2 — plataforma (sede) donde se realiza la inducción
            "ALTER TABLE ptc_cap_dia ADD COLUMN sede_id INTEGER DEFAULT NULL",
            "ALTER TABLE ptc_evento ADD COLUMN sede_id INTEGER DEFAULT NULL",
            "ALTER TABLE ptc_persona ADD COLUMN firma_url TEXT DEFAULT ''",
            "ALTER TABLE ptc_evaluacion ADD COLUMN origen TEXT DEFAULT 'manual'",
            "ALTER TABLE ptc_sancion ADD COLUMN origen TEXT DEFAULT 'manual'",
            "ALTER TABLE ptc_novedad ADD COLUMN origen TEXT DEFAULT 'manual'",
            "ALTER TABLE ptc_capacitacion ADD COLUMN tipo TEXT DEFAULT 'Interna'",
            "ALTER TABLE ptc_capacitacion ADD COLUMN costo REAL DEFAULT NULL",
            "ALTER TABLE ptc_novedad ADD COLUMN aprobador_persona_id INTEGER DEFAULT NULL",
            "ALTER TABLE ptc_novedad ADD COLUMN firma_aprobador_url TEXT DEFAULT ''",
            "ALTER TABLE ptc_novedad ADD COLUMN aprobado_en TEXT DEFAULT NULL",
            # tipo/costo de la capacitación viven en el evento real (Agenda),
            # no en un formulario aparte — ver _sync_capacitacion en tc_agenda.py.
            "ALTER TABLE ptc_evento ADD COLUMN modalidad TEXT DEFAULT 'Interna'",
            "ALTER TABLE ptc_evento ADD COLUMN costo REAL DEFAULT NULL",
            "ALTER TABLE ptc_persona ADD COLUMN tarjeta TEXT DEFAULT ''",
            "ALTER TABLE ptc_persona ADD COLUMN tarjeta_fecha_asignacion DATE DEFAULT NULL",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS ptc_cargo_sede "
            "(cargo_id INTEGER NOT NULL, sede_id INTEGER NOT NULL, PRIMARY KEY (cargo_id, sede_id))"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS ptc_config "
            "(key TEXT PRIMARY KEY, value TEXT)"
        ))
        conn.commit()

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS ptc_cliente_asignacion "
            "(cliente_id INTEGER NOT NULL, sede_id INTEGER NOT NULL, "
            "persona_id INTEGER DEFAULT NULL, "
            "PRIMARY KEY (cliente_id, sede_id))"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS ptc_cliente_analista "
            "(id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, "
            "persona_id INTEGER NOT NULL, "
            "UNIQUE (cliente_id, persona_id))"
        ))
        conn.commit()

        row = conn.execute(text("SELECT value FROM ptc_config WHERE key='organigrama_reset_v1'")).first()
        if not row:
            conn.execute(text("UPDATE ptc_cargo SET parent_id = NULL, en_organigrama = 0"))
            conn.execute(text("INSERT INTO ptc_config (key, value) VALUES ('organigrama_reset_v1', 'done')"))
            conn.commit()
