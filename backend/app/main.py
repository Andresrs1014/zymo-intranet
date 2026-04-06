from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlmodel import Session, select

from app.database import create_db_and_tables, get_engine
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role  # noqa: F401 — necesario para que SQLModel registre la tabla
from app.config import settings
from app.routers import auth, users, roles


_DEFAULT_ROLES = [
    {
        "name": "admin",
        "label": "Administrador",
        "description": "Acceso total al sistema",
        "app_permissions": [],  # admin siempre ve todo en código
    },
    {
        "name": "directivo",
        "label": "Directivo",
        "description": "Acceso directivo y gerencial",
        "app_permissions": ["matriz"],
    },
    {
        "name": "talento_cultura",
        "label": "Talento y Cultura",
        "description": "Gestión de talento humano",
        "app_permissions": ["matriz", "oc", "capacitaciones"],
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
        "app_permissions": ["matriz"],
    },
    {
        "name": "empleado",
        "label": "Empleado",
        "description": "Acceso básico para colaboradores",
        "app_permissions": ["matriz"],
    },
]


def _migrate_db() -> None:
    """Agrega columnas nuevas si la tabla ya existe (migraciones ligeras)."""
    with get_engine().connect() as conn:
        try:
            conn.execute(text("ALTER TABLE role ADD COLUMN app_permissions JSON"))
            conn.commit()
            print("[migrate] Columna app_permissions agregada.")
        except Exception:
            pass  # La columna ya existe


def _seed_roles() -> None:
    with Session(get_engine()) as session:
        for r in _DEFAULT_ROLES:
            existing = session.exec(select(Role).where(Role.name == r["name"])).first()
            if not existing:
                session.add(Role(**r))
            elif existing.app_permissions is None:
                # Actualiza roles sembrados antes de Phase 3
                existing.app_permissions = r["app_permissions"]
                session.add(existing)
        session.commit()
    print("[seed] Roles verificados.")


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    _migrate_db()
    _seed_roles()
    _seed_admin()
    yield


app = FastAPI(
    title="ZYMO Intranet API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)


@app.get("/health")
def health():
    return {"status": "ok"}
