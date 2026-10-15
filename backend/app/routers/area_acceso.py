"""Organización: usuarios de un área, su cargo en el directorio y los permisos que se les dan a mano. Solo admin.

Solo organiza quién VE qué; no toca la lógica de ninguna herramienta.
"""
import re
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.config import settings
from app.core.deps import require_admin
from app.core.security import hash_password
from app.database import get_db
from app.models.area import Area
from app.models.area_acceso import HerramientaAcceso, UsuarioPermiso
from app.models.sede import Sede
from app.models.user import User
from app.personal_database import PtcCargo, PtcCargoSede, PtcPersona, get_personal_engine
from app.services.acceso_area import permisos_no_permitidos

router = APIRouter(tags=["Organización"])

_PERMISO = re.compile(r"^[a-z][a-z0-9_]{2,99}$")
_INVALIDO = status.HTTP_422_UNPROCESSABLE_ENTITY


class PermisosIn(BaseModel):
    permisos: list[str] = []


class CargoIn(BaseModel):
    cargo_id: int | None = None
    nombre: str | None = Field(default=None, max_length=150)


class UsuarioNuevoIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)
    sede: str | None = None
    cargo: str | None = Field(default=None, max_length=150)  # opcional
    permisos: list[str] = []  # opcional


class ExclusivoIn(BaseModel):
    areas: list[int]


def _area(db: Session, area_id: int) -> Area:
    area = db.get(Area, area_id)
    if not area:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Área no encontrada.")
    return area


def _usuario(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado.")
    return user


def _permisos_validos(db: Session, user: User, permisos: list[str]) -> list[str]:
    limpios = list(dict.fromkeys(p.strip() for p in permisos if p.strip()))
    if any(not _PERMISO.match(p) for p in limpios):
        raise HTTPException(_INVALIDO, "Permiso inválido.")
    bloqueados = permisos_no_permitidos(db, user, limpios)
    if bloqueados:
        raise HTTPException(_INVALIDO, f"Exclusivos de otras áreas (o la persona no tiene área): {', '.join(bloqueados)}.")
    return limpios


def _guardar_permisos(db: Session, user: User, permisos: list[str]) -> list[str]:
    limpios = _permisos_validos(db, user, permisos)
    for fila in db.exec(select(UsuarioPermiso).where(UsuarioPermiso.user_id == user.id)).all():
        db.delete(fila)
    db.flush()
    for p in limpios:
        db.add(UsuarioPermiso(user_id=user.id, permiso=p))
    return limpios


def _cargos_area(pdb: Session, area_id: int) -> dict[int, PtcCargo]:
    """Cargos de un área: los suyos y los que usan las personas del área (en el directorio la mayoría de cargos no tiene área)."""
    propios = pdb.exec(select(PtcCargo).where(PtcCargo.area_id == area_id, PtcCargo.org_key == "")).all()
    usados = {p.cargo_id for p in pdb.exec(select(PtcPersona).where(PtcPersona.area_id == area_id)).all() if p.cargo_id}
    por_uso = pdb.exec(select(PtcCargo).where(PtcCargo.id.in_(usados))).all() if usados else []
    return {c.id: c for c in [*propios, *por_uso]}


def _poner_cargo(db: Session, area_id: int, user: User, cargo_id: int | None, nombre: str) -> PtcCargo:
    """Pone el cargo de la persona en el directorio. Si el usuario aún no tiene ficha, enlaza una existente por correo o crea una."""
    with Session(get_personal_engine()) as pdb:
        fichas = pdb.exec(select(PtcPersona).where(PtcPersona.user_id == user.id)).all()
        if len(fichas) > 1:
            raise HTTPException(_INVALIDO, f"Este usuario está vinculado a {len(fichas)} fichas del directorio; corrige el vínculo en T&C primero.")
        elegibles = [c for c in pdb.exec(select(PtcCargo).where(PtcCargo.org_key == "")).all() if c.area_id in (None, area_id)]
        if cargo_id is not None:
            cargo = next((c for c in elegibles if c.id == cargo_id), None)
            if cargo is None:
                raise HTTPException(_INVALIDO, "Ese cargo no se puede usar en esta área.")
        else:
            cargo = next((c for c in elegibles if c.nombre.strip().lower() == nombre.lower()), None)
            if cargo is None:
                cargo = PtcCargo(area_id=area_id, nombre=nombre)
                pdb.add(cargo)
                pdb.flush()
        sede = db.exec(select(Sede).where(Sede.name == user.sede)).first() if user.sede else None
        if sede and not pdb.get(PtcCargoSede, (cargo.id, sede.id)):
            pdb.add(PtcCargoSede(cargo_id=cargo.id, sede_id=sede.id))
        persona = fichas[0] if fichas else None
        if persona is None:  # ficha ya existente en el directorio (sin usuario) con el mismo correo, o una nueva
            correo = user.email.lower()
            candidatas = pdb.exec(select(PtcPersona).where(PtcPersona.user_id.is_(None))).all()  # type: ignore[union-attr]
            persona = next((p for p in candidatas if correo in ((p.email or "").lower(), (p.email_corporativo or "").lower())), None)
            if persona is None:
                persona = PtcPersona(nombre=user.full_name or user.email, email=user.email, sede_id=sede.id if sede else 0)
            persona.user_id = user.id
        persona.area_id = area_id  # el área de la persona y la de su ficha van juntas
        persona.cargo_id = cargo.id
        persona.updated_at = datetime.utcnow()
        pdb.add(persona)
        pdb.commit()
        pdb.refresh(cargo)
        return cargo


# ── Usuarios del área ─────────────────────────────────────────────────────────

@router.get("/areas/{area_id}/usuarios")
def usuarios_del_area(area_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Usuarios del área (por su ficha del directorio o por el texto `User.area`), con su cargo y los permisos que tienen asignados."""
    area = _area(db, area_id)
    with Session(get_personal_engine()) as pdb:
        en_area = pdb.exec(select(PtcPersona).where(PtcPersona.area_id == area_id, PtcPersona.user_id.is_not(None))).all()  # type: ignore[union-attr]
        cargos = {c.id: c.nombre for c in pdb.exec(select(PtcCargo)).all()}
        users = {u.id: u for u in db.exec(select(User).where(User.area == area.name)).all()}
        for p in en_area:
            if p.user_id not in users and (u := db.get(User, p.user_id)):
                users[p.user_id] = u
        # fichas vinculadas a cada usuario (pueden estar en otra área, o ser varias por un vínculo mal hecho)
        fichas: dict[int, list[PtcPersona]] = {}
        if users:
            for p in pdb.exec(select(PtcPersona).where(PtcPersona.user_id.in_(list(users)))).all():
                fichas.setdefault(p.user_id, []).append(p)
    dados: dict[int, list[str]] = {}
    if users:
        for f in db.exec(select(UsuarioPermiso).where(UsuarioPermiso.user_id.in_(list(users)))).all():
            dados.setdefault(f.user_id, []).append(f.permiso)
    salida = []
    for u in sorted(users.values(), key=lambda x: (x.full_name or x.email).lower()):
        lista = fichas.get(u.id, [])
        p = lista[0] if len(lista) == 1 else None  # con varias fichas el vínculo es ambiguo: no se adivina
        salida.append({
            "id": u.id, "full_name": u.full_name, "email": u.email, "sede": u.sede, "is_active": u.is_active,
            "fichas": len(lista),
            "persona_id": p.id if p else None,
            "persona_area_id": p.area_id if p else None,
            "cargo_id": p.cargo_id if p else None,
            "cargo": cargos.get(p.cargo_id) if p and p.cargo_id else None,
            "permisos": sorted(dados.get(u.id, [])),
        })
    return salida


@router.post("/areas/{area_id}/usuarios", status_code=status.HTTP_201_CREATED)
def crear_usuario(area_id: int, body: UsuarioNuevoIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Crea la persona en el área. El cargo y los permisos son opcionales y se pueden poner después."""
    area = _area(db, area_id)
    if db.exec(select(User).where(func.lower(User.email) == body.email.lower())).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo.")
    user = User(email=body.email, hashed_password=hash_password(body.password), full_name=body.full_name.strip(),
                role="empleado", sede=body.sede or None, area=area.name)
    db.add(user)
    try:
        db.flush()
        if body.permisos:
            _guardar_permisos(db, user, body.permisos)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo.")
    except HTTPException:
        db.rollback()
        raise
    db.refresh(user)
    # Una cuenta recién creada no puede tener fichas previas legítimas: son vínculos viejos de un usuario borrado.
    with Session(get_personal_engine()) as pdb:
        for vieja in pdb.exec(select(PtcPersona).where(PtcPersona.user_id == user.id)).all():
            vieja.user_id = None
            pdb.add(vieja)
        pdb.commit()
    cargo = None
    if body.cargo and body.cargo.strip():
        cargo = _poner_cargo(db, area_id, user, None, body.cargo.strip()).nombre
    return {"id": user.id, "email": user.email, "cargo": cargo}


@router.put("/areas/{area_id}/usuarios/{user_id}/cargo")
def cambiar_cargo(area_id: int, user_id: int, body: CargoIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Pone el cargo de la persona en el directorio: uno existente del área o uno nuevo escrito a mano."""
    _area(db, area_id)
    user = _usuario(db, user_id)
    nombre = (body.nombre or "").strip()
    if body.cargo_id is None and not nombre:
        raise HTTPException(_INVALIDO, "Escribe o elige un cargo.")
    cargo = _poner_cargo(db, area_id, user, body.cargo_id, nombre)
    return {"cargo_id": cargo.id, "cargo": cargo.nombre}


@router.put("/areas/{area_id}/usuarios/{user_id}/permisos")
def fijar_permisos(area_id: int, user_id: int, body: PermisosIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Reemplaza los permisos de la persona (Editar permisos)."""
    _area(db, area_id)
    user = _usuario(db, user_id)
    guardados = _guardar_permisos(db, user, body.permisos)
    db.commit()
    return {"user_id": user.id, "permisos": sorted(guardados)}


@router.get("/areas/{area_id}/cargos")
def cargos_del_area(area_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Cargos que se pueden elegir en el área (`de_area`: ya los usa o le pertenecen; el resto son cargos sin área asignada)."""
    _area(db, area_id)
    with Session(get_personal_engine()) as pdb:
        suyos = _cargos_area(pdb, area_id)
        libres = [c for c in pdb.exec(select(PtcCargo).where(PtcCargo.area_id.is_(None), PtcCargo.org_key == "")).all() if c.id not in suyos]  # type: ignore[union-attr]
    todos = [(c, True) for c in suyos.values()] + [(c, False) for c in libres]
    return [{"id": c.id, "nombre": c.nombre, "de_area": de} for c, de in sorted(todos, key=lambda t: t[0].nombre.lower())]


# ── Catálogo para otros servicios (SIG) ───────────────────────────────────────

@router.get("/acceso/catalogo-areas")
def catalogo_areas(x_internal_key: str | None = Header(default=None), db: Session = Depends(get_db)):
    """Áreas con sus cargos. Lo lee el SIG para crear sus carpetas desde aquí (las áreas se gestionan solo en Organización). Requiere X-Internal-Key."""
    if not (x_internal_key and settings.internal_key and x_internal_key == settings.internal_key):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Clave interna inválida.")
    areas = db.exec(select(Area).order_by(Area.name)).all()
    with Session(get_personal_engine()) as pdb:
        return [
            {"id": a.id, "name": a.name, "cargos": sorted(c.nombre for c in _cargos_area(pdb, a.id).values())}
            for a in areas
        ]


# ── Aplicaciones compartidas / exclusivas ─────────────────────────────────────

@router.get("/acceso/exclusivos")
def listar_exclusivos(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [{"permiso": h.permiso, "areas": h.areas or []} for h in db.exec(select(HerramientaAcceso)).all()]


@router.put("/acceso/exclusivos/{permiso}")
def hacer_exclusivo(permiso: str, body: ExclusivoIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Marca un permiso como exclusivo de las áreas dadas. Lista vacía = vuelve a ser compartido."""
    if not _PERMISO.match(permiso):
        raise HTTPException(_INVALIDO, "Permiso inválido.")
    if not body.areas:
        fila = db.get(HerramientaAcceso, permiso)
        if fila:
            db.delete(fila)
            db.commit()
        return {"permiso": permiso, "areas": []}
    existentes = {a.id for a in db.exec(select(Area).where(Area.id.in_(body.areas))).all()}
    if existentes != set(body.areas):
        raise HTTPException(_INVALIDO, "Alguna de las áreas no existe.")
    fila = db.get(HerramientaAcceso, permiso) or HerramientaAcceso(permiso=permiso)
    fila.areas = sorted(existentes)
    db.add(fila)
    db.commit()
    return {"permiso": permiso, "areas": fila.areas}
