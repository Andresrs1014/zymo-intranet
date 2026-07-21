"""
Router módulo T&C — Talento y Cultura (Personal).

Prefijo: /tc
Acceso: admin, talento_cultura (mod_tc)
"""
from datetime import datetime
from typing import Optional

import os

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.core.deps import get_current_user, require_admin, require_permission
from app.database import get_db
from app.models.area import Area as GlobalArea
from app.models.sede import Sede
from app.models.user import User
from app.personal_database import (
    PtcArea,
    PtcCapacitacion,
    PtcCargo,
    PtcCargoSede,
    PtcEvaluacion,
    PtcNovedad,
    PtcPersona,
    PtcSancion,
    get_personal_db,
)
from app.services.tc_manual_extraction import (
    cargo_manual_flags,
    extraer_desde_archivo,
    extraer_texto_manual,
    manual_disk_path,
    sniff_excel_ext,
)

router = APIRouter(prefix="/tc", tags=["T&C Personal"])

require_tc          = require_permission("mod_tc")
require_tc_editar   = require_permission("mod_tc_editar")
require_tc_sensible = require_permission("mod_tc_sensible")
require_tc_importar = require_permission("mod_tc_importar")
require_tc_or_sig   = require_permission("mod_tc", "mod_sig")

# ── Constantes de dominio ─────────────────────────────────────────────────────
_ACTIVO         = "Activo"
_INACTIVO       = "Inactivo"
_GENEROS_STATS  = ("Masculino", "Femenino")
_MAX_MANUAL_MB  = 20
_MAX_FOTO_MB    = 5


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
    fecha_nacimiento: Optional[str] = None  # ISO "YYYY-MM-DD"
    edad: Optional[int] = None
    tipo_contrato: str = "Término indefinido"
    fecha_ingreso: Optional[str] = None   # ISO date string "YYYY-MM-DD"
    antiguedad_label: str = ""
    estado: str = "Activo"
    idp_active: bool = False
    idp_eligible: bool = True
    user_id: Optional[int] = None
    jefe_directo_id: Optional[int] = None


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
    fecha_nacimiento: Optional[str] = None  # ISO "YYYY-MM-DD"
    edad: Optional[int] = None
    tipo_contrato: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    antiguedad_label: Optional[str] = None
    estado: Optional[str] = None
    tipo_salida: Optional[str] = None
    fecha_salida: Optional[str] = None
    idp_active: Optional[bool] = None
    idp_eligible: Optional[bool] = None
    score: Optional[int] = None
    user_id: Optional[int] = None
    jefe_directo_id: Optional[int] = None


class BulkEstadoItem(BaseModel):
    id: int
    estado: str
    tipo_salida: Optional[str] = None
    fecha_salida: Optional[str] = None


class BulkEstadoBody(BaseModel):
    items: list[BulkEstadoItem]


class AreaCreate(BaseModel):
    empresa_id: int
    nombre: str


class CargoCreate(BaseModel):
    area_id: Optional[int] = None
    parent_id: Optional[int] = None
    en_organigrama: bool = False
    org_context: str = "corporativo"
    nombre: str
    sede_ids: list[int] = []


class CargoUpdate(BaseModel):
    nombre: Optional[str] = None
    area_id: Optional[int] = None
    parent_id: Optional[int] = None
    en_organigrama: Optional[bool] = None
    sede_ids: Optional[list[int]] = None
    org_context: Optional[str] = None
    org_number: Optional[str] = None
    org_image_url: Optional[str] = None
    org_pos_x: Optional[float] = None
    org_pos_y: Optional[float] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _email_corporativo_efectivo(p: PtcPersona, main_db: Session) -> str:
    """Correo corporativo con fallback al email de login de la intranet.

    Muchas personas nunca llenan "Correo corporativo" en su perfil de T&C,
    pero si tienen cuenta en la intranet (user_id), ese email de login ES
    su correo corporativo por política de la empresa — no hace falta que
    lo repitan a mano. Consumido por integraciones (ej. sync de ZymoAlly)
    que necesitan un correo confiable, sin depender de que alguien llene
    un campo duplicado. El campo "email_corporativo" crudo sigue intacto
    para la UI de T&C (edición manual del perfil).
    """
    if p.email_corporativo:
        return p.email_corporativo
    if p.user_id:
        user = main_db.get(User, p.user_id)
        if user and user.email:
            return user.email
    return ""


def _persona_dict(p: PtcPersona, db: Session, main_db: Session) -> dict:
    sede  = main_db.get(Sede, p.sede_id) if p.sede_id else None
    area  = main_db.get(GlobalArea, p.area_id) if p.area_id else None
    cargo = db.get(PtcCargo, p.cargo_id) if p.cargo_id else None
    jefe  = db.get(PtcPersona, p.jefe_directo_id) if p.jefe_directo_id else None
    return {
        "id": p.id,
        "nombre": p.nombre,
        "initials": p.initials,
        "documento": p.documento,
        "empresa_id": p.sede_id,
        "empresa_nombre": sede.name if sede else "",
        "empresa_codigo": sede.name if sede else "",
        "area_id": p.area_id,
        "area_nombre": area.name if area else "",
        "cargo_id": p.cargo_id,
        "cargo_nombre": cargo.nombre if cargo else "",
        "jefe_directo_id": p.jefe_directo_id,
        "jefe_directo_nombre": jefe.nombre if jefe else "",
        "genero": p.genero,
        "rh": p.rh,
        "email": p.email,
        "email_corporativo": p.email_corporativo,
        "email_corporativo_efectivo": _email_corporativo_efectivo(p, main_db),
        "telefono": p.telefono,
        "telefono_corporativo": p.telefono_corporativo,
        "foto_url": p.foto_url,
        "fecha_nacimiento": p.fecha_nacimiento.isoformat() if p.fecha_nacimiento else None,
        "edad": p.edad,
        "tipo_contrato": p.tipo_contrato,
        "fecha_ingreso": p.fecha_ingreso.isoformat() if p.fecha_ingreso else None,
        "antiguedad_label": p.antiguedad_label,
        "estado": p.estado,
        "tipo_salida": p.tipo_salida,
        "fecha_salida": p.fecha_salida.isoformat() if p.fecha_salida else None,
        "idp_active": p.idp_active,
        "idp_eligible": p.idp_eligible,
        "score": p.score,
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


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def stats_globales(
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    todas = db.exec(select(PtcPersona)).all()
    activos    = [p for p in todas if p.estado == _ACTIVO]
    inactivos  = [p for p in todas if p.estado != _ACTIVO]
    con_genero = [p for p in todas if p.genero in _GENEROS_STATS]

    sedes = main_db.exec(select(Sede)).all()
    por_empresa = []
    for s in sedes:
        emp_personas = [p for p in todas if p.sede_id == s.id]
        if emp_personas:
            por_empresa.append({
                "id": s.id,
                "codigo": s.name,
                "nombre": s.name,
                "total": len(emp_personas),
                "activos": sum(1 for p in emp_personas if p.estado == _ACTIVO),
            })

    return {
        "total":    len(todas),
        "activos":  len(activos),
        "inactivos": len(inactivos),
        "masculino_pct": round(
            sum(1 for p in con_genero if p.genero == _GENEROS_STATS[0]) / len(con_genero) * 100
            if con_genero else 0
        ),
        "femenino_pct": round(
            sum(1 for p in con_genero if p.genero == _GENEROS_STATS[1]) / len(con_genero) * 100
            if con_genero else 0
        ),
        "por_empresa": por_empresa,
    }


# ── Empresas ──────────────────────────────────────────────────────────────────

@router.get("/empresas")
def listar_empresas(
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    """Devuelve las sedes del sistema como lista de empresas (fuente única de verdad)."""
    sedes = main_db.exec(select(Sede)).all()
    return [{"id": s.id, "nombre": s.name, "codigo": s.name} for s in sedes]


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
    sede_id: Optional[int] = Query(default=None),
    area_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    q = select(PtcCargo)
    if sede_id is not None:
        cargo_ids_sede = select(PtcCargoSede.cargo_id).where(PtcCargoSede.sede_id == sede_id)
        q = q.where(col(PtcCargo.id).in_(cargo_ids_sede))
    if area_id is not None:
        q = q.where(PtcCargo.area_id == area_id)
    cargos = db.exec(q.order_by(col(PtcCargo.nombre))).all()
    cargo_ids = [c.id for c in cargos]
    sedes_rows = db.exec(
        select(PtcCargoSede).where(col(PtcCargoSede.cargo_id).in_(cargo_ids))
    ).all() if cargo_ids else []
    cargo_sedes: dict[int, list[int]] = {}
    for cs in sedes_rows:
        cargo_sedes.setdefault(cs.cargo_id, []).append(cs.sede_id)
    return [
        {
            "id": c.id,
            "area_id": c.area_id,
            "parent_id": c.parent_id,
            "en_organigrama": bool(c.en_organigrama),
            "nombre": c.nombre,
            "manual_url": c.manual_url,
            "manual_filename": c.manual_filename,
            "sede_ids": cargo_sedes.get(c.id, []),
            **cargo_manual_flags(c.manual_url, c.manual_text),
        }
        for c in cargos
    ]


@router.get("/cargos-sig")
def listar_cargos_sig(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_or_sig),
):
    """Lectura mínima de cargos para asignación en SIG — no requiere mod_tc."""
    cargos = db.exec(select(PtcCargo).order_by(col(PtcCargo.nombre))).all()
    return [
        {
            "id": c.id,
            "nombre": c.nombre,
            **cargo_manual_flags(c.manual_url, c.manual_text),
        }
        for c in cargos
    ]


@router.post("/cargos", status_code=status.HTTP_201_CREATED)
def crear_cargo(
    body: CargoCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    nombre = body.nombre.strip()
    existing = db.exec(select(PtcCargo).where(col(PtcCargo.nombre).ilike(nombre))).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cargo con ese nombre.")
    # Valida que el padre exista (si se proporcionó)
    if body.parent_id is not None:
        if not db.get(PtcCargo, body.parent_id):
            raise HTTPException(status_code=400, detail="El cargo padre no existe.")
    cargo = PtcCargo(
        area_id=body.area_id,
        parent_id=body.parent_id,
        nombre=nombre,
        en_organigrama=body.en_organigrama,
        org_context=body.org_context.strip() or "corporativo",
        org_key="",
    )
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    for sid in body.sede_ids:
        db.add(PtcCargoSede(cargo_id=cargo.id, sede_id=sid))
    if body.sede_ids:
        db.commit()
    return {"id": cargo.id, "area_id": cargo.area_id, "nombre": cargo.nombre, "sede_ids": body.sede_ids}


_MANUAL_MIME: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel.sheet.macroEnabled.12": "xlsx",
    "application/vnd.ms-excel": "xls",
}

_MANUAL_FILENAME_EXT: dict[str, str] = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "doc",
    ".xlsx": "xlsx",
    ".xlsm": "xlsx",
    ".xls": "xls",
}


def _resolve_manual_ext(content_type: str | None, filename: str | None) -> str | None:
    if content_type and content_type in _MANUAL_MIME:
        return _MANUAL_MIME[content_type]
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext in _MANUAL_FILENAME_EXT:
            return _MANUAL_FILENAME_EXT[ext]
    return None


def _reextract_cargo(cargo: PtcCargo) -> dict:
    if not cargo.manual_url:
        return {"ok": False, "error": "Sin archivo de manual"}
    path = manual_disk_path(cargo.id, cargo.manual_url)
    if not path:
        return {"ok": False, "error": "Archivo no encontrado en disco"}
    texto = extraer_desde_archivo(path)
    cargo.manual_text = texto
    flags = cargo_manual_flags(cargo.manual_url, texto)
    return {
        "ok": True,
        "id": cargo.id,
        "nombre": cargo.nombre,
        **flags,
    }


@router.post("/cargos/{cargo_id}/manual/reextract")
def reextract_manual_cargo(
    cargo_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    """Re-extrae manual_text desde el archivo ya guardado (útil tras migración o .doc legacy)."""
    cargo = db.get(PtcCargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado.")
    result = _reextract_cargo(cargo)
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "No se pudo extraer texto"))
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return result


@router.post("/cargos/reextract-manuales")
def reextract_manuales_bulk(
    force: bool = Query(False, description="Si true, re-extrae todos los manuales con archivo"),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    """Re-extrae manual_text desde archivos guardados (consumido por SIG análisis IA)."""
    cargos = db.exec(
        select(PtcCargo).where(PtcCargo.manual_url != "")
    ).all()
    ok, fail, skip, actualizados = 0, 0, 0, 0
    detalle_fallos: list[dict] = []
    for cargo in cargos:
        flags = cargo_manual_flags(cargo.manual_url, cargo.manual_text)
        if flags["tiene_manual"] and not force:
            skip += 1
            continue
        result = _reextract_cargo(cargo)
        if not result.get("ok"):
            fail += 1
            if len(detalle_fallos) < 15:
                detalle_fallos.append({
                    "id": cargo.id,
                    "nombre": cargo.nombre,
                    "error": result.get("error") or "No se pudo leer el archivo",
                    "texto_chars": result.get("texto_chars", 0),
                })
            continue
        db.add(cargo)
        actualizados += 1
        if result.get("tiene_manual"):
            ok += 1
        else:
            fail += 1
            if len(detalle_fallos) < 15:
                detalle_fallos.append({
                    "id": cargo.id,
                    "nombre": cargo.nombre,
                    "error": "Texto vacío tras extracción",
                    "texto_chars": result.get("texto_chars", 0),
                })
    db.commit()
    return {
        "procesados": len(cargos),
        "extraidos_ok": ok,
        "sin_texto": fail,
        "ya_tenian_texto": skip,
        "actualizados": actualizados,
        "fallos_muestra": detalle_fallos,
    }


@router.post("/cargos/{cargo_id}/manual")
async def subir_manual(
    cargo_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cargo = db.get(PtcCargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado.")
    ext = _resolve_manual_ext(file.content_type, file.filename)
    if not ext:
        raise HTTPException(status_code=400, detail="Solo se permiten PDF, Word (.docx/.doc) y Excel (.xlsx/.xls).")
    content = await file.read()
    if len(content) > _MAX_MANUAL_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"El archivo no puede superar los {_MAX_MANUAL_MB} MB.")

    if ext in ("xlsx", "xls", "xlsm"):
        ext = sniff_excel_ext(content, ext)
    manuales_dir = settings.tc_manuales_dir
    os.makedirs(manuales_dir, exist_ok=True)
    with open(os.path.join(manuales_dir, f"{cargo_id}.{ext}"), "wb") as f:
        f.write(content)

    cargo.manual_url = f"/tc-manuales/{cargo_id}.{ext}"
    cargo.manual_filename = file.filename or f"manual_{cargo_id}.{ext}"
    cargo.manual_text = extraer_texto_manual(content, ext)
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    flags = cargo_manual_flags(cargo.manual_url, cargo.manual_text)
    return {
        "id": cargo.id,
        "manual_url": cargo.manual_url,
        "manual_filename": cargo.manual_filename,
        **flags,
        "advertencia": (
            None if flags["tiene_manual"]
            else "Archivo guardado pero no se extrajo texto suficiente para análisis IA. "
                 "En Excel verifique que el contenido esté en celdas (no solo imágenes) "
                 "o use Re-extraer texto."
        ),
    }


@router.delete("/cargos/{cargo_id}/manual", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_manual(
    cargo_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cargo = db.get(PtcCargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado.")
    if cargo.manual_url:
        path = manual_disk_path(cargo_id, cargo.manual_url)
        if path and os.path.isfile(path):
            os.remove(path)
    cargo.manual_url = ""
    cargo.manual_filename = ""
    cargo.manual_text = ""
    db.add(cargo)
    db.commit()


def _persona_jefe_creates_cycle(
    db: Session,
    persona_id: int,
    jefe_directo_id: int,
) -> bool:
    # ponytail: una persona tiene un solo jefe directo; recorrer ancestros basta.
    current_id: Optional[int] = jefe_directo_id
    visited: set[int] = set()
    while current_id is not None and current_id not in visited:
        if current_id == persona_id:
            return True
        visited.add(current_id)
        current = db.get(PtcPersona, current_id)
        if not current:
            return False
        current_id = current.jefe_directo_id
    return False


def _cargo_parent_creates_cycle(
    db: Session,
    cargo_id: int,
    parent_id: int,
) -> bool:
    # ponytail: un cargo tiene un solo padre; recorrer ancestros basta.
    current_id: Optional[int] = parent_id
    visited: set[int] = set()
    while current_id is not None and current_id not in visited:
        if current_id == cargo_id:
            return True
        visited.add(current_id)
        current = db.get(PtcCargo, current_id)
        if not current:
            return False
        current_id = current.parent_id
    return False


@router.put("/cargos/{cargo_id}")
def actualizar_cargo(
    cargo_id: int,
    body: CargoUpdate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cargo = db.get(PtcCargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado.")
    data = body.model_dump(exclude_unset=True)
    sede_ids = data.pop("sede_ids", None)
    # Valida parent_id si se está actualizando
    if "parent_id" in data and data["parent_id"] is not None:
        if data["parent_id"] == cargo_id:
            raise HTTPException(status_code=400, detail="Un cargo no puede ser su propio padre.")
        if not db.get(PtcCargo, data["parent_id"]):
            raise HTTPException(status_code=400, detail="El cargo padre no existe.")
        if _cargo_parent_creates_cycle(db, cargo_id, data["parent_id"]):
            raise HTTPException(
                status_code=400,
                detail="El cargo padre no puede ser un descendiente del cargo.",
            )
    for field, value in data.items():
        setattr(cargo, field, value)
    db.add(cargo)
    if sede_ids is not None:
        for row in db.exec(select(PtcCargoSede).where(PtcCargoSede.cargo_id == cargo_id)).all():
            db.delete(row)
        for sid in sede_ids:
            db.add(PtcCargoSede(cargo_id=cargo_id, sede_id=sid))
    db.commit()
    db.refresh(cargo)
    current_sedes = [
        r.sede_id for r in db.exec(select(PtcCargoSede).where(PtcCargoSede.cargo_id == cargo_id)).all()
    ]
    return {"id": cargo.id, "area_id": cargo.area_id, "nombre": cargo.nombre, "sede_ids": current_sedes}


@router.delete("/cargos/{cargo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cargo(
    cargo_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cargo = db.get(PtcCargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado.")
    personas_con_cargo = db.exec(
        select(PtcPersona).where(PtcPersona.cargo_id == cargo_id)
    ).all()
    if personas_con_cargo:
        raise HTTPException(
            status_code=400,
            detail=f"El cargo tiene {len(personas_con_cargo)} colaborador(es) asignado(s). Reasigna antes de eliminar.",
        )
    for row in db.exec(select(PtcCargoSede).where(PtcCargoSede.cargo_id == cargo_id)).all():
        db.delete(row)
    db.delete(cargo)
    db.commit()


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
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    query = select(PtcPersona)
    if q:
        term = f"%{q.lower()}%"
        query = query.where(
            col(PtcPersona.nombre).ilike(term) | col(PtcPersona.documento).ilike(term)
        )
    if empresa_id is not None:
        query = query.where(PtcPersona.sede_id == empresa_id)
    if area_id is not None:
        query = query.where(PtcPersona.area_id == area_id)
    if cargo_id is not None:
        query = query.where(PtcPersona.cargo_id == cargo_id)
    if estado:
        query = query.where(PtcPersona.estado == estado)

    total = len(db.exec(query).all())
    personas = db.exec(query.order_by(col(PtcPersona.nombre)).offset(skip).limit(limit)).all()
    return {"total": total, "items": [_persona_dict(p, db, main_db) for p in personas]}


@router.get("/personas/{persona_id}")
def obtener_persona(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")
    return _persona_dict(persona, db, main_db)


@router.post("/personas", status_code=status.HTTP_201_CREATED)
def crear_persona(
    body: PersonaCreate,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_editar),
):
    if not main_db.get(Sede, body.empresa_id):
        raise HTTPException(status_code=400, detail="Sede (empresa) no encontrada.")

    initials = body.initials or "".join(
        w[0].upper() for w in body.nombre.split()[:2] if w
    )
    persona = PtcPersona(
        nombre=body.nombre.strip(),
        initials=initials,
        documento=body.documento,
        sede_id=body.empresa_id,
        area_id=body.area_id,
        cargo_id=body.cargo_id,
        genero=body.genero,
        rh=body.rh,
        email=body.email,
        email_corporativo=body.email_corporativo,
        telefono=body.telefono,
        telefono_corporativo=body.telefono_corporativo,
        fecha_nacimiento=_parse_date(body.fecha_nacimiento),
        edad=body.edad,
        tipo_contrato=body.tipo_contrato,
        fecha_ingreso=_parse_date(body.fecha_ingreso),
        antiguedad_label=body.antiguedad_label,
        estado=body.estado,
        idp_active=body.idp_active,
        idp_eligible=body.idp_eligible,
        user_id=body.user_id,
        jefe_directo_id=body.jefe_directo_id,
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return _persona_dict(persona, db, main_db)


@router.put("/personas/{persona_id}")
def actualizar_persona(
    persona_id: int,
    body: PersonaUpdate,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_editar),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")

    data = body.model_dump(exclude_unset=True)
    # empresa_id es el alias público de sede_id (cross-DB, sin FK)
    if "empresa_id" in data:
        data["sede_id"] = data.pop("empresa_id")
    if data.get("jefe_directo_id") is not None:
        if data["jefe_directo_id"] == persona_id:
            raise HTTPException(status_code=400, detail="Una persona no puede ser su propio jefe directo.")
        if _persona_jefe_creates_cycle(db, persona_id, data["jefe_directo_id"]):
            raise HTTPException(status_code=400, detail="Esa jerarquía crearía un ciclo (A es jefe de B que es jefe de A).")
    for field, value in data.items():
        if field in ("fecha_ingreso", "fecha_salida", "fecha_nacimiento"):
            setattr(persona, field, _parse_date(value))
        else:
            setattr(persona, field, value)

    persona.updated_at = datetime.utcnow()
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return _persona_dict(persona, db, main_db)


@router.patch("/personas/bulk-estado")
def actualizar_estado_personas(
    body: BulkEstadoBody,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
) -> dict:
    if len(body.items) > 200:
        raise HTTPException(status_code=400, detail="Máximo 200 items por solicitud.")

    updated = 0
    errors = []
    for item in body.items:
        if item.estado not in (_ACTIVO, _INACTIVO):
            errors.append({"id": item.id, "detail": "Estado inválido."})
            continue

        persona = db.get(PtcPersona, item.id)
        if not persona:
            errors.append({"id": item.id, "detail": "Persona no encontrada"})
            continue
        if (
            item.estado == _INACTIVO
            and item.tipo_salida not in ("voluntaria", "involuntaria")
        ):
            errors.append(
                {"id": item.id, "detail": "tipo_salida inválido para persona inactiva."}
            )
            continue

        persona.estado = item.estado
        if item.estado == _ACTIVO:
            persona.tipo_salida = ""
            persona.fecha_salida = None
        else:
            persona.tipo_salida = item.tipo_salida
            persona.fecha_salida = _parse_date(item.fecha_salida)
        persona.updated_at = datetime.utcnow()
        db.add(persona)
        updated += 1

    db.commit()
    return {"updated": updated, "errors": errors}


@router.post("/personas/{persona_id}/foto")
async def subir_foto_persona(
    persona_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_editar),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes.")

    content = await file.read()
    if len(content) > _MAX_FOTO_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"La imagen no puede superar los {_MAX_FOTO_MB} MB.")

    ext = {"image/png": "png", "image/webp": "webp"}.get(file.content_type, "jpg")
    fotos_dir = settings.tc_fotos_dir
    os.makedirs(fotos_dir, exist_ok=True)
    with open(os.path.join(fotos_dir, f"{persona_id}.{ext}"), "wb") as f:
        f.write(content)

    persona.foto_url = f"/tc-fotos/{persona_id}.{ext}"
    persona.updated_at = datetime.utcnow()
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return _persona_dict(persona, db, main_db)


@router.post("/cargos/{cargo_id}/org-image")
async def subir_imagen_cargo(
    cargo_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cargo = db.get(PtcCargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes.")

    content = await file.read()
    if len(content) > _MAX_FOTO_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"La imagen no puede superar los {_MAX_FOTO_MB} MB.")

    ext = {"image/png": "png", "image/webp": "webp"}.get(file.content_type, "jpg")
    fotos_dir = settings.tc_fotos_dir
    os.makedirs(fotos_dir, exist_ok=True)
    fname = f"cargo-{cargo_id}.{ext}"
    with open(os.path.join(fotos_dir, fname), "wb") as f:
        f.write(content)

    cargo.org_image_url = f"/tc-fotos/{fname}"
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return {
        "id": cargo.id,
        "org_image_url": cargo.org_image_url,
        "org_number": cargo.org_number or "",
        "nombre": cargo.nombre,
    }


@router.delete("/personas/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_persona(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada.")
    persona.estado = _INACTIVO
    persona.updated_at = datetime.utcnow()
    db.add(persona)
    db.commit()


# ── Import JSON (migración inicial desde export del Directorio) ───────────────

class ImportPersonaItem(BaseModel):
    legacy_id: str
    nombre: str
    initials: str = ""
    documento: str = ""
    company_legacy_id: int          # clave de mapeo → sede_id via sede_map
    area_nombre: str = ""
    cargo_nombre: str = ""
    genero: str = ""
    rh: str = ""
    email: str = ""
    email_corporativo: str = ""
    telefono: str = ""
    fecha_nacimiento: Optional[str] = None
    edad: Optional[int] = None
    tipo_contrato: str = "Término indefinido"
    fecha_ingreso: Optional[str] = None
    antiguedad_label: str = ""
    estado: str = "Activo"
    tipo_salida: str = ""
    fecha_salida: Optional[str] = None
    idp_active: bool = False
    idp_eligible: bool = True


class ImportBody(BaseModel):
    items: list[ImportPersonaItem]
    sede_map: dict[int, int]  # {company_legacy_id → Sede.id}


@router.post("/import/json", status_code=status.HTTP_200_OK)
def import_personas_json(
    body: ImportBody,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_importar),
):
    created = 0
    skipped = 0

    for item in body.items:
        existing = db.exec(
            select(PtcPersona).where(PtcPersona.legacy_id == item.legacy_id)
        ).first()
        if existing:
            skipped += 1
            continue

        sede_id = body.sede_map.get(item.company_legacy_id)
        if not sede_id:
            skipped += 1
            continue

        cargo_id = None
        if item.cargo_nombre.strip():
            cargo = db.exec(
                select(PtcCargo).where(
                    col(PtcCargo.nombre).ilike(item.cargo_nombre.strip()),
                )
            ).first()
            if not cargo:
                cargo = PtcCargo(nombre=item.cargo_nombre.strip())
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
            sede_id=sede_id,
            cargo_id=cargo_id,
            genero=item.genero,
            rh=item.rh,
            email=item.email,
            email_corporativo=item.email_corporativo,
            telefono=item.telefono,
            fecha_nacimiento=_parse_date(item.fecha_nacimiento),
            edad=item.edad,
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


# ── Organigrama ───────────────────────────────────────────────────────────────

@router.get("/organigrama")
def obtener_organigrama(
    sede_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    all_areas = main_db.exec(select(GlobalArea).order_by(GlobalArea.name)).all()

    q = select(PtcCargo)
    if sede_id is not None:
        cargo_ids_sede = select(PtcCargoSede.cargo_id).where(PtcCargoSede.sede_id == sede_id)
        q = q.where(col(PtcCargo.id).in_(cargo_ids_sede))
    cargos = db.exec(q.order_by(col(PtcCargo.nombre))).all()

    por_area: dict = {}
    for c in cargos:
        por_area.setdefault(c.area_id, []).append({"id": c.id, "nombre": c.nombre})

    return {
        "areas": [
            {"id": a.id, "nombre": a.name, "cargos": por_area[a.id]}
            for a in all_areas if a.id in por_area
        ],
        "sin_area": por_area.get(None, []),
    }


@router.post("/organigrama/reseed")
def reseed_organigrama(
    main_db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Reaplica el seed sin borrar fotos ni números editados de cargos existentes."""
    from sqlalchemy import text

    from app.personal_database import get_personal_engine
    from app.tc_org_seed import seed_organigrama_if_needed

    with get_personal_engine().begin() as conn:
        conn.execute(text(
            "DELETE FROM ptc_config WHERE key='organigrama_seed_v2'"
        ))
    seed_organigrama_if_needed(main_db)
    return {"ok": True, "detail": "Organigrama resembrado."}


@router.get("/organigrama-arbol")
def obtener_organigrama_arbol(
    sede_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    """Árbol jerárquico de cargos con personas y fotos. Filtra por org_context."""
    org_context = "corporativo" if sede_id is None else f"sede:{sede_id}"

    q = select(PtcCargo).where(
        PtcCargo.en_organigrama == True,  # noqa: E712
        PtcCargo.org_context == org_context,
    )
    cargos = db.exec(q.order_by(col(PtcCargo.nombre))).all()
    cargo_ids_en_set = {c.id for c in cargos}

    q_pending = select(PtcCargo).where(
        PtcCargo.en_organigrama == False,  # noqa: E712
        PtcCargo.org_context == org_context,
    )
    pending = db.exec(q_pending.order_by(col(PtcCargo.nombre))).all()

    # 2. Personas activas agrupadas por cargo_id
    personas_rows = db.exec(
        select(PtcPersona).where(
            col(PtcPersona.cargo_id).in_(list(cargo_ids_en_set)),
            PtcPersona.estado == "Activo",
        )
    ).all() if cargo_ids_en_set else []
    personas_por_cargo: dict[int, list[dict]] = {}
    for p in personas_rows:
        personas_por_cargo.setdefault(p.cargo_id, []).append({
            "id": p.id,
            "nombre": p.nombre,
            "initials": p.initials,
            "foto_url": p.foto_url,
        })

    # 3. Construye nodos
    nodos: dict[int, dict] = {}
    for c in cargos:
        nodos[c.id] = {
            "id": c.id,
            "nombre": c.nombre,
            "area_id": c.area_id,
            "parent_id": c.parent_id,
            "org_number": c.org_number or "",
            "org_image_url": c.org_image_url or "",
            "org_pos_x": c.org_pos_x,
            "org_pos_y": c.org_pos_y,
            "personas": personas_por_cargo.get(c.id, []),
            "hijos": [],
        }

    # 4. Enlaza hijos al padre (solo si el padre también está en el filtro)
    raices: list[dict] = []
    for nodo in nodos.values():
        pid = nodo["parent_id"]
        if pid is not None and pid in nodos:
            nodos[pid]["hijos"].append(nodo)
        else:
            raices.append(nodo)

    # 5. Detecta ciclos: nodos no alcanzables desde ninguna raíz
    def _reachable(nodes: list[dict], visited: set[int]) -> None:
        for n in nodes:
            if n["id"] not in visited:
                visited.add(n["id"])
                _reachable(n["hijos"], visited)

    reachable: set[int] = set()
    _reachable(raices, reachable)
    orphans = [n for n in nodos.values() if n["id"] not in reachable]
    if orphans:
        # ponytail: elimina back-references para evitar recursión infinita en el frontend
        for n in orphans:
            if n["parent_id"] is not None and n["parent_id"] in nodos:
                parent = nodos[n["parent_id"]]
                parent["hijos"] = [h for h in parent["hijos"] if h["id"] != n["id"]]
            n["parent_id"] = None
            raices.append(n)

    sin_colocar = [{"id": c.id, "nombre": c.nombre, "area_id": c.area_id} for c in pending]
    return {"raices": raices, "sin_colocar": sin_colocar}


# ── Capacitaciones ────────────────────────────────────────────────────────────

class CapacitacionCreate(BaseModel):
    titulo: str
    fecha: Optional[str] = None
    horas: Optional[float] = None
    estado: str = "Completado"
    diploma_url: str = ""
    observaciones: str = ""


@router.get("/personas/{persona_id}/capacitaciones")
def listar_capacitaciones(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    rows = db.exec(
        select(PtcCapacitacion)
        .where(PtcCapacitacion.persona_id == persona_id)
        .order_by(col(PtcCapacitacion.fecha).desc())
    ).all()
    return [
        {
            "id": r.id, "titulo": r.titulo, "fecha": r.fecha.isoformat() if r.fecha else None,
            "horas": r.horas, "estado": r.estado, "diploma_url": r.diploma_url,
            "observaciones": r.observaciones,
        }
        for r in rows
    ]


@router.post("/personas/{persona_id}/capacitaciones", status_code=201)
def crear_capacitacion(
    persona_id: int,
    body: CapacitacionCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    cap = PtcCapacitacion(
        persona_id=persona_id,
        titulo=body.titulo.strip(),
        fecha=_parse_date(body.fecha),
        horas=body.horas,
        estado=body.estado,
        diploma_url=body.diploma_url.strip(),
        observaciones=body.observaciones.strip(),
    )
    db.add(cap)
    db.commit()
    db.refresh(cap)
    return {"id": cap.id, "titulo": cap.titulo, "fecha": cap.fecha.isoformat() if cap.fecha else None,
            "horas": cap.horas, "estado": cap.estado, "diploma_url": cap.diploma_url,
            "observaciones": cap.observaciones}


@router.delete("/capacitaciones/{cap_id}", status_code=204)
def eliminar_capacitacion(
    cap_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    cap = db.get(PtcCapacitacion, cap_id)
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")
    db.delete(cap)
    db.commit()


# ── Evaluaciones (sensible) ───────────────────────────────────────────────────

class EvaluacionCreate(BaseModel):
    titulo: str
    puntaje: Optional[float] = None
    cumple_meta: bool = False
    fecha: Optional[str] = None
    observaciones: str = ""


@router.get("/personas/{persona_id}/evaluaciones")
def listar_evaluaciones(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    rows = db.exec(
        select(PtcEvaluacion)
        .where(PtcEvaluacion.persona_id == persona_id)
        .order_by(col(PtcEvaluacion.fecha).desc())
    ).all()
    return [
        {
            "id": r.id, "titulo": r.titulo, "puntaje": r.puntaje,
            "cumple_meta": r.cumple_meta, "fecha": r.fecha.isoformat() if r.fecha else None,
            "observaciones": r.observaciones,
        }
        for r in rows
    ]


@router.post("/personas/{persona_id}/evaluaciones", status_code=201)
def crear_evaluacion(
    persona_id: int,
    body: EvaluacionCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    ev = PtcEvaluacion(
        persona_id=persona_id,
        titulo=body.titulo.strip(),
        puntaje=body.puntaje,
        cumple_meta=body.cumple_meta,
        fecha=_parse_date(body.fecha),
        observaciones=body.observaciones.strip(),
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return {"id": ev.id, "titulo": ev.titulo, "puntaje": ev.puntaje,
            "cumple_meta": ev.cumple_meta, "fecha": ev.fecha.isoformat() if ev.fecha else None,
            "observaciones": ev.observaciones}


@router.delete("/evaluaciones/{ev_id}", status_code=204)
def eliminar_evaluacion(
    ev_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    ev = db.get(PtcEvaluacion, ev_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    db.delete(ev)
    db.commit()


# ── Sanciones (sensible) ──────────────────────────────────────────────────────

class SancionCreate(BaseModel):
    tipo: str = "Llamado de atención"
    descripcion: str = ""
    fecha: Optional[str] = None


@router.get("/personas/{persona_id}/sanciones")
def listar_sanciones(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    rows = db.exec(
        select(PtcSancion)
        .where(PtcSancion.persona_id == persona_id)
        .order_by(col(PtcSancion.fecha).desc())
    ).all()
    return [
        {
            "id": r.id, "tipo": r.tipo, "descripcion": r.descripcion,
            "fecha": r.fecha.isoformat() if r.fecha else None,
        }
        for r in rows
    ]


@router.post("/personas/{persona_id}/sanciones", status_code=201)
def crear_sancion(
    persona_id: int,
    body: SancionCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    san = PtcSancion(
        persona_id=persona_id,
        tipo=body.tipo.strip(),
        descripcion=body.descripcion.strip(),
        fecha=_parse_date(body.fecha),
    )
    db.add(san)
    db.commit()
    db.refresh(san)
    return {"id": san.id, "tipo": san.tipo, "descripcion": san.descripcion,
            "fecha": san.fecha.isoformat() if san.fecha else None}


@router.delete("/sanciones/{san_id}", status_code=204)
def eliminar_sancion(
    san_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    san = db.get(PtcSancion, san_id)
    if not san:
        raise HTTPException(status_code=404, detail="Sanción no encontrada")
    db.delete(san)
    db.commit()


# ── Novedades (sensible) ──────────────────────────────────────────────────────

class NovedadCreate(BaseModel):
    tipo: str = "Permiso remunerado"
    descripcion: str = ""
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    estado: str = "Pendiente"


class NovedadUpdate(BaseModel):
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    estado: Optional[str] = None


@router.get("/personas/{persona_id}/novedades")
def listar_novedades(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    rows = db.exec(
        select(PtcNovedad)
        .where(PtcNovedad.persona_id == persona_id)
        .order_by(col(PtcNovedad.fecha_inicio).desc())
    ).all()
    return [
        {
            "id": r.id, "tipo": r.tipo, "descripcion": r.descripcion,
            "fecha_inicio": r.fecha_inicio.isoformat() if r.fecha_inicio else None,
            "fecha_fin": r.fecha_fin.isoformat() if r.fecha_fin else None,
            "estado": r.estado,
        }
        for r in rows
    ]


@router.post("/personas/{persona_id}/novedades", status_code=201)
def crear_novedad(
    persona_id: int,
    body: NovedadCreate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    if not db.get(PtcPersona, persona_id):
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    nov = PtcNovedad(
        persona_id=persona_id,
        tipo=body.tipo.strip(),
        descripcion=body.descripcion.strip(),
        fecha_inicio=_parse_date(body.fecha_inicio),
        fecha_fin=_parse_date(body.fecha_fin),
        estado=body.estado,
    )
    db.add(nov)
    db.commit()
    db.refresh(nov)
    return {
        "id": nov.id, "tipo": nov.tipo, "descripcion": nov.descripcion,
        "fecha_inicio": nov.fecha_inicio.isoformat() if nov.fecha_inicio else None,
        "fecha_fin": nov.fecha_fin.isoformat() if nov.fecha_fin else None,
        "estado": nov.estado,
    }


@router.put("/novedades/{nov_id}")
def actualizar_novedad(
    nov_id: int,
    body: NovedadUpdate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    nov = db.get(PtcNovedad, nov_id)
    if not nov:
        raise HTTPException(status_code=404, detail="Novedad no encontrada")
    upd = body.model_dump(exclude_unset=True)
    for field, value in upd.items():
        if field in ("fecha_inicio", "fecha_fin"):
            setattr(nov, field, _parse_date(value))
        else:
            setattr(nov, field, value)
    db.add(nov)
    db.commit()
    db.refresh(nov)
    return {
        "id": nov.id, "tipo": nov.tipo, "descripcion": nov.descripcion,
        "fecha_inicio": nov.fecha_inicio.isoformat() if nov.fecha_inicio else None,
        "fecha_fin": nov.fecha_fin.isoformat() if nov.fecha_fin else None,
        "estado": nov.estado,
    }


@router.delete("/novedades/{nov_id}", status_code=204)
def eliminar_novedad(
    nov_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    nov = db.get(PtcNovedad, nov_id)
    if not nov:
        raise HTTPException(status_code=404, detail="Novedad no encontrada")
    db.delete(nov)
    db.commit()


@router.get("/novedades")
def listar_todas_novedades(
    estado: Optional[str] = Query(default=None),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    """Lista todas las novedades del módulo, opcionalmente filtradas por estado."""
    q = select(PtcNovedad).order_by(col(PtcNovedad.fecha_inicio).desc())
    if estado:
        q = q.where(PtcNovedad.estado == estado)
    rows = db.exec(q).all()
    # Resuelve nombres de personas para mostrar en el listado global
    persona_ids = {r.persona_id for r in rows}
    personas = {
        p.id: p.nombre
        for p in db.exec(select(PtcPersona).where(col(PtcPersona.id).in_(list(persona_ids)))).all()
    } if persona_ids else {}
    return [
        {
            "id": r.id,
            "persona_id": r.persona_id,
            "persona_nombre": personas.get(r.persona_id, ""),
            "tipo": r.tipo,
            "descripcion": r.descripcion,
            "fecha_inicio": r.fecha_inicio.isoformat() if r.fecha_inicio else None,
            "fecha_fin": r.fecha_fin.isoformat() if r.fecha_fin else None,
            "estado": r.estado,
        }
        for r in rows
    ]


# ── KPIs ──────────────────────────────────────────────────────────────────────

_MES_ES = ("", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")


def _last_months(n: int = 6) -> list[tuple[int, int]]:
    from datetime import date as _date
    today = _date.today()
    y, m = today.year, today.month
    out: list[tuple[int, int]] = []
    for _ in range(n):
        out.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(out))


def _is_salida_voluntaria(tipo: str) -> bool:
    t = (tipo or "").strip().lower()
    if t in ("voluntaria", "involuntaria"):
        return t == "voluntaria"
    return "voluntar" in t or t == "mutuo acuerdo"


def _compute_kpi_charts(db: Session, activos: int) -> dict:
    from datetime import date as _date, timedelta
    from sqlalchemy import func as sqlfunc

    months = _last_months(6)
    labels = [_MES_ES[m] for _, m in months]

    rotacion_vals: list[float] = []
    cap_vals: list[float] = []
    for y, mo in months:
        start = _date(y, mo, 1)
        end = _date(y + 1, 1, 1) if mo == 12 else _date(y, mo + 1, 1)
        salidas = db.exec(
            select(sqlfunc.count(PtcPersona.id)).where(
                PtcPersona.fecha_salida >= start,
                PtcPersona.fecha_salida < end,
                PtcPersona.estado == _INACTIVO,
            )
        ).one()
        rotacion_vals.append(round((salidas / max(activos, 1)) * 100, 1))

        caps = db.exec(
            select(PtcCapacitacion).where(
                PtcCapacitacion.fecha >= start,
                PtcCapacitacion.fecha < end,
            )
        ).all()
        if caps:
            done = sum(1 for c in caps if c.estado == "Completado")
            cap_vals.append(round((done / len(caps)) * 100, 1))
        else:
            cap_vals.append(0.0)

    hace_12m = _date.today() - timedelta(days=365)
    inactivos_12m = db.exec(
        select(PtcPersona).where(
            PtcPersona.estado == _INACTIVO,
            col(PtcPersona.fecha_salida).is_not(None),
            PtcPersona.fecha_salida >= hace_12m,
        )
    ).all()
    vol = sum(1 for p in inactivos_12m if _is_salida_voluntaria(p.tipo_salida))
    inv = len(inactivos_12m) - vol

    early = 0
    ingresos_12m = 0
    for p in inactivos_12m:
        if p.fecha_ingreso and p.fecha_salida:
            dias = (p.fecha_salida - p.fecha_ingreso).days
            if dias <= 60:
                early += 1
    ingresos_12m = db.exec(
        select(sqlfunc.count(PtcPersona.id)).where(
            col(PtcPersona.fecha_ingreso).is_not(None),
            PtcPersona.fecha_ingreso >= hace_12m,
        )
    ).one()
    early_pct = round((early / max(ingresos_12m, 1)) * 100, 1)

    evals = db.exec(
        select(PtcEvaluacion).where(col(PtcEvaluacion.puntaje).is_not(None))
    ).all()
    buckets = [0, 0, 0, 0, 0]
    for e in evals:
        idx = min(max(int(round(float(e.puntaje or 0))), 1), 5) - 1
        buckets[idx] += 1

    return {
        "rotacion_mensual": {"labels": labels, "values": rotacion_vals},
        "salida_tipo": {"voluntaria": vol, "involuntaria": inv},
        "rotacion_temprana_pct": early_pct,
        "cap_completacion_mensual": {"labels": labels, "values": cap_vals},
        "eval_distribucion": {
            "labels": ["Bajo", "Básico", "Esperado", "Alto", "Excelente"],
            "values": buckets,
        },
    }


def _antiguedad_promedio(db: Session) -> float:
    from datetime import date as _date
    personas = db.exec(
        select(PtcPersona).where(
            PtcPersona.estado == _ACTIVO,
            col(PtcPersona.fecha_ingreso).is_not(None),
        )
    ).all()
    if not personas:
        return 0.0
    today = _date.today()
    total = sum((today - p.fecha_ingreso).days / 365.25 for p in personas if p.fecha_ingreso)
    return round(total / len(personas), 1)


@router.get("/kpis")
def kpis(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_sensible),
):
    from sqlalchemy import func as sqlfunc

    total = db.exec(select(sqlfunc.count(PtcPersona.id))).one()
    activos = db.exec(
        select(sqlfunc.count(PtcPersona.id)).where(PtcPersona.estado == _ACTIVO)
    ).one()
    inactivos = total - activos

    # Rotación: personas con fecha_salida en los últimos 12 meses / promedio activos
    from datetime import date as _date, timedelta
    hace_12m = _date.today() - timedelta(days=365)
    salidas_12m = db.exec(
        select(sqlfunc.count(PtcPersona.id)).where(
            PtcPersona.fecha_salida >= hace_12m,
            PtcPersona.estado == _INACTIVO,
        )
    ).one()
    rotacion_pct = round((salidas_12m / max(activos, 1)) * 100, 1)

    # Capacitación
    total_caps = db.exec(select(sqlfunc.count(PtcCapacitacion.id))).one()
    completadas = db.exec(
        select(sqlfunc.count(PtcCapacitacion.id)).where(PtcCapacitacion.estado == "Completado")
    ).one()
    horas_total = db.exec(
        select(sqlfunc.sum(PtcCapacitacion.horas)).where(col(PtcCapacitacion.horas).isnot(None))
    ).one() or 0
    personas_con_cap = db.exec(
        select(sqlfunc.count(sqlfunc.distinct(PtcCapacitacion.persona_id)))
    ).one()
    horas_pp = round(float(horas_total) / max(activos, 1), 1)
    cobertura_pct = round((personas_con_cap / max(activos, 1)) * 100, 1)
    completacion_pct = round((completadas / max(total_caps, 1)) * 100, 1)

    # Evaluaciones
    total_evals = db.exec(select(sqlfunc.count(PtcEvaluacion.id))).one()
    puntaje_avg = db.exec(
        select(sqlfunc.avg(PtcEvaluacion.puntaje)).where(col(PtcEvaluacion.puntaje).isnot(None))
    ).one()
    metas_cumplidas = db.exec(
        select(sqlfunc.count(PtcEvaluacion.id)).where(PtcEvaluacion.cumple_meta == True)  # noqa: E712
    ).one()
    cumplimiento_pct = round((metas_cumplidas / max(total_evals, 1)) * 100, 1)

    # IDP
    idp_activos = db.exec(
        select(sqlfunc.count(PtcPersona.id)).where(
            PtcPersona.idp_active == True,  # noqa: E712
            PtcPersona.estado == _ACTIVO,
        )
    ).one()
    idp_pct = round((idp_activos / max(activos, 1)) * 100, 1)

    # Sanciones
    total_sanciones = db.exec(select(sqlfunc.count(PtcSancion.id))).one()
    personas_con_sancion = db.exec(
        select(sqlfunc.count(sqlfunc.distinct(PtcSancion.persona_id)))
    ).one()

    # Novedades
    total_novedades = db.exec(select(sqlfunc.count(PtcNovedad.id))).one()
    pendientes_novedades = db.exec(
        select(sqlfunc.count(PtcNovedad.id)).where(PtcNovedad.estado == "Pendiente")
    ).one()

    return {
        "headcount": {
            "total": total,
            "activos": activos,
            "inactivos": inactivos,
            "antiguedad_anios": _antiguedad_promedio(db),
        },
        "rotacion": {"salidas_12m": salidas_12m, "tasa_pct": rotacion_pct},
        "capacitacion": {
            "total_registros": total_caps,
            "completadas": completadas,
            "completacion_pct": completacion_pct,
            "horas_por_persona": horas_pp,
            "cobertura_pct": cobertura_pct,
            "personas_capacitadas": personas_con_cap,
        },
        "evaluaciones": {
            "total": total_evals,
            "puntaje_promedio": round(float(puntaje_avg or 0), 2),
            "cumplimiento_metas_pct": cumplimiento_pct,
        },
        "idp": {"activos": idp_activos, "cobertura_pct": idp_pct},
        "sanciones": {"total": total_sanciones, "personas_afectadas": personas_con_sancion},
        "novedades": {"total": total_novedades, "pendientes": pendientes_novedades},
        "charts": _compute_kpi_charts(db, activos),
    }
