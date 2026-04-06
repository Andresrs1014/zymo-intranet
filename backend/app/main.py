from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.database import create_db_and_tables, get_engine
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role  # noqa: F401 — necesario para que SQLModel registre la tabla
from app.config import settings
from app.routers import auth, users, roles


_DEFAULT_ROLES = [
    {"name": "admin",           "label": "Administrador",    "description": "Acceso total al sistema"},
    {"name": "directivo",       "label": "Directivo",        "description": "Acceso directivo y gerencial"},
    {"name": "talento_cultura", "label": "Talento y Cultura","description": "Gestión de talento humano"},
    {"name": "comercial",       "label": "Comercial",        "description": "Área comercial y ventas"},
    {"name": "operativo",       "label": "Operativo",        "description": "Operaciones logísticas"},
    {"name": "empleado",        "label": "Empleado",         "description": "Acceso básico para colaboradores"},
]


def _seed_roles() -> None:
    with Session(get_engine()) as session:
        for r in _DEFAULT_ROLES:
            exists = session.exec(select(Role).where(Role.name == r["name"])).first()
            if not exists:
                session.add(Role(**r))
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
