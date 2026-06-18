"""
Router módulo T&C — Talento y Cultura (Personal).

Prefijo: /tc
Acceso: admin, talento_cultura (mod_tc)
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.core.deps import get_current_user, require_permission
from app.models.user import User
from app.personal_database import (
    PtcArea,
    PtcCargo,
    PtcEmpresa,
    PtcPersona,
    get_personal_db,
)

router = APIRouter(prefix="/tc", tags=["T&C Personal"])

require_tc = require_permission("mod_tc")
require_tc_editar = require_permission("mod_tc_editar")
require_tc_importar = require_permission("mod_tc_importar")


# ── Schemas ───────────────────────────────────────────────────────────────────

class PersonaCreate(BaseModel):
    nombre: str
    documento: str = ""
    initials: str = ""
    empresa_id: int
    area_id: Optional[int] = None
    cargo_id: Optional[int] = None
    genero: str = ""
    rh: str = ""
    email: str = ""
    email_corporativo: str = ""
    telefono: str = ""
    telefono_corporativo: str = ""
    tipo_contrato: str = "Término indefinido"
    fecha_ingreso: Optional[str] = None   # ISO date string "YYYY-MM-DD"
    antiguedad_label: str = ""
    estado: str = "Activo"
    idp_active: bool = False
    idp_eligible: bool = True
    user_id: Optional[int] = None


class PersonaUpdate(BaseModel):
    nombre: Optional[str] = None
    documento: Optional[str] = None
    initials: Optional[str] = None
    empresa_id: Optional[int] = None
    area_id: Optional[int] = None
    cargo_id: Optional[int] = None
    genero: Optional[str] = None
    rh: Optional[str] = None
    email: Optional[str] = None
    email_corporativo: Optional[str] = None
    telefono: Optional[str] = None
    telefono_corporativo: Optional[str] = None
    tipo_contrato: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    antiguedad_label: Optional[str] = None
    estado: Optional[str] = None
    tipo_salida: Optional[str] = None
    fecha_salida: Optional[str] = None
    idp_active: Optional[bool] = None
    idp_eligible: Optional[bool] = None
    user_id: Optional[int] = None


class AreaCreate(BaseModel):
    empresa_id: int
    nombre: str


class CargoCreate(BaseModel):
    empresa_id: int
    area_id: Optional[int] = None
    nombre: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _persona_dict(p: PtcPersona, db: Session) -> dict:
    empresa = db.get(PtcEmpresa, p.empresa_id)
    area = db.get(PtcArea, p.area_id) if p.area_id else None
    cargo = db.get(PtcCargo, p.cargo_id) if p.cargo_id else None
    return {
        "id": p.id,
        "nombre": p.nombre,
        "initials": p.initials,
        "documento": p.documento,
        "empresa_id": p.empresa_id,
        "empresa_nombre": empresa.nombre if empresa else "",
        "empresa_codigo": empresa.codigo if empresa else "",
        "area_id": p.area_id,
        "area_nombre": area.nombre if area else "",
        "cargo_id": p.cargo_id,
        "cargo_nombre": cargo.nombre if cargo else "",
        "genero": p.genero,
        "rh": p.rh,
        "email": p.email,
        "email_corporativo": p.email_corporativo,
        "telefono": p.telefono,
        "telefono_corporativo": p.telefono_corporativo,
        "foto_url": p.foto_url,
        "tipo_contrato": p.tipo_contrato,
        "fecha_ingreso": p.fecha_ingreso.isoformat() if p.fecha_ingreso else None,
        "antiguedad_label": p.antiguedad_label,
        "estado": p.estado,
        "tipo_salida": p.tipo_salida,
        "fecha_salida": p.fecha_salida.isoformat() if p.fecha_salida else None,
        "idp_active": p.idp_active,
        "idp_eligible": p.idp_eligible,
        "user_id": p.user_id,
        "legacy_id": p.legacy_id,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


def _parse_date(value: Optional[str]):
    if not value:
        return None
    from datetime import date
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


# ── Empresas ──────────────────────────────────────────────────────────────────

@router.get("/empresas")
def listar_empresas(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    empresas = db.exec(select(PtcEmpresa)).all()
    return [{"id": e.id, "nombre": e.nombre, "codigo": e.codigo, "sede_ref": e.sede_ref} for e in empresas]


# ── Áreas ─────────────────────────────────────────────────────────────────────

@router.get("/areas")
def listar_areas(
    empresa_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    q = select(PtcArea)
    if empresa_id is not None:
        q = q.where(PtcArea.empresa_id == empresa_id)
    areas = db.exec(q.order_by(col(PtcArea.nombre))).all()
    return [{"id": a.id, "empresa_id": a.empresa_id, "nombre": a.nombre} for a in areas]


@router.post("/areas", status_code=status.HTTP_201_CREATED)
def crear_area(
    body: AreaCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    area = PtcArea(empresa_id=body.empresa_id, nombre=body.nombre.strip())
    db.add(area)
    db.commit()
    db.refresh(area)
    return {"id": area.id, "empresa_id": area.empresa_id, "nombre": area.nombre}


# ── Cargos ────────────────────────────────────────────────────────────────────

@router.get("/cargos")
def listar_cargos(
    empresa_id: Optional[int] = Query(default=None),
    area_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    q = select(PtcCargo)
    if empresa_id is not None:
        q = q.where(PtcCargo.empresa_id == empresa_id)
    if area_id is not None:
        q = q.where(PtcCargo.area_id == area_id)
    cargos = db.exec(q.order_by(col(PtcCargo.nombre))).all()
    return [{"id": c.id, "empresa_id": c.empresa_id, "area_id": c.area_id, "nombre": c.nombre} for c in cargos]


@router.post("/cargos", status_code=status.HTTP_201_CREATED)
def crear_cargo(
    body: CargoCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cargo = PtcCargo(empresa_id=body.empresa_id, area_id=body.area_id, nombre=body.nombre.strip())
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return {"id": cargo.id, "empresa_id": cargo.empresa_id, "area_id": cargo.area_id, "nombre": cargo.nombre}


# ── Personas ──────────────────────────────────────────────────────────────────

@router.get("/personas")
def listar_personas(
    q: Optional[str] = Query(default=None, description="Búsqueda por nombre o documento"),
    empresa_id: Optional[int] = Query(default=None),
    area_id: Optional[int] = Query(default=None),
    cargo_id: Optional[int] = Query(default=None),
    estado: Optional[str] = Query(default=None, description="Activo | Inactivo"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    query = select(PtcPersona)
    if q:
        term = f"%{q.lower()}%"
        query = query.where(
            col(PtcPersona.nombre).ilike(term) | col(PtcPersona.documento).ilike(term)
        )
    if empresa_id is not None:
        query = query.where(PtcPersona.empresa_id == empresa_id)
    if area_id is not None:
        query = query.where(PtcPersona.area_id == area_id)
    if cargo_id is not None:
        query = query.where(PtcPersona.cargo_id == cargo_id)
    if estado:
        query = query.where(PtcPersona.estado == estado)

    total = len(db.exec(query).all())
    personas = db.exec(query.order_by(col(PtcPersona.nombre)).offset(skip).limit(limit)).all()
    return {"total": total, "items": [_persona_dict(p, db) for p in personas]}


@router.get("/personas/{persona_id}")
def obtener_persona(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")
    return _persona_dict(persona, db)


@router.post("/personas", status_code=status.HTTP_201_CREATED)
def crear_persona(
    body: PersonaCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    if not db.get(PtcEmpresa, body.empresa_id):
        raise HTTPException(status_code=400, detail="Empresa no encontrada.")

    initials = body.initials or "".join(
        w[0].upper() for w in body.nombre.split()[:2] if w
    )
    persona = PtcPersona(
        nombre=body.nombre.strip(),
        initials=initials,
        documento=body.documento,
        empresa_id=body.empresa_id,
        area_id=body.area_id,
        cargo_id=body.cargo_id,
        genero=body.genero,
        rh=body.rh,
        email=body.email,
        email_corporativo=body.email_corporativo,
        telefono=body.telefono,
        telefono_corporativo=body.telefono_corporativo,
        tipo_contrato=body.tipo_contrato,
        fecha_ingreso=_parse_date(body.fecha_ingreso),
        antiguedad_label=body.antiguedad_label,
        estado=body.estado,
        idp_active=body.idp_active,
        idp_eligible=body.idp_eligible,
        user_id=body.user_id,
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return _persona_dict(persona, db)


@router.put("/personas/{persona_id}")
def actualizar_persona(
    persona_id: int,
    body: PersonaUpdate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")

    data = body.model_dump(exclude_none=True)
    for field, value in data.items():
        if field == "fecha_ingreso":
            setattr(persona, field, _parse_date(value))
        elif field == "fecha_salida":
            setattr(persona, field, _parse_date(value))
        else:
            setattr(persona, field, value)

    persona.updated_at = datetime.utcnow()
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return _persona_dict(persona, db)


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_persona(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")
    persona.estado = "Inactivo"
    persona.updated_at = datetime.utcnow()
    db.add(persona)
    db.commit()


# ── Import JSON (migración inicial desde export del Directorio) ───────────────

class ImportPersonaItem(BaseModel):
    legacy_id: str
    nombre: str
    initials: str = ""
    documento: str = ""
    company_legacy_id: int          # 0, 1 o 2
    area_nombre: str = ""
    cargo_nombre: str = ""
    genero: str = ""
    rh: str = ""
    email: str = ""
    email_corporativo: str = ""
    telefono: str = ""
    tipo_contrato: str = "Término indefinido"
    fecha_ingreso: Optional[str] = None
    antiguedad_label: str = ""
    estado: str = "Activo"
    tipo_salida: str = ""
    fecha_salida: Optional[str] = None
    idp_active: bool = False
    idp_eligible: bool = True


@router.post("/import/json", status_code=status.HTTP_200_OK)
def import_personas_json(
    items: list[ImportPersonaItem],
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_importar),
):
    created = 0
    skipped = 0

    for item in items:
        # Skip si ya existe el legacy_id
        existing = db.exec(
            select(PtcPersona).where(PtcPersona.legacy_id == item.legacy_id)
        ).first()
        if existing:
            skipped += 1
            continue

        # Resolver empresa por legacy_id
        empresa = db.exec(
            select(PtcEmpresa).where(PtcEmpresa.legacy_id == item.company_legacy_id)
        ).first()
        if not empresa:
            skipped += 1
            continue

        # Autocreate área si viene
        area_id = None
        if item.area_nombre.strip():
            area = db.exec(
                select(PtcArea).where(
                    PtcArea.empresa_id == empresa.id,
                    col(PtcArea.nombre).ilike(item.area_nombre.strip()),
                )
            ).first()
            if not area:
                area = PtcArea(empresa_id=empresa.id, nombre=item.area_nombre.strip())
                db.add(area)
                db.flush()
            area_id = area.id

        # Autocreate cargo si viene
        cargo_id = None
        if item.cargo_nombre.strip():
            cargo = db.exec(
                select(PtcCargo).where(
                    PtcCargo.empresa_id == empresa.id,
                    col(PtcCargo.nombre).ilike(item.cargo_nombre.strip()),
                )
            ).first()
            if not cargo:
                cargo = PtcCargo(
                    empresa_id=empresa.id,
                    area_id=area_id,
                    nombre=item.cargo_nombre.strip(),
                )
                db.add(cargo)
                db.flush()
            cargo_id = cargo.id

        initials = item.initials or "".join(
            w[0].upper() for w in item.nombre.split()[:2] if w
        )
        persona = PtcPersona(
            legacy_id=item.legacy_id,
            nombre=item.nombre.strip(),
            initials=initials,
            documento=item.documento,
            empresa_id=empresa.id,
            area_id=area_id,
            cargo_id=cargo_id,
            genero=item.genero,
            rh=item.rh,
            email=item.email,
            email_corporativo=item.email_corporativo,
            telefono=item.telefono,
            tipo_contrato=item.tipo_contrato,
            fecha_ingreso=_parse_date(item.fecha_ingreso),
            antiguedad_label=item.antiguedad_label,
            estado=item.estado,
            tipo_salida=item.tipo_salida,
            fecha_salida=_parse_date(item.fecha_salida),
            idp_active=item.idp_active,
            idp_eligible=item.idp_eligible,
        )
        db.add(persona)
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped}
