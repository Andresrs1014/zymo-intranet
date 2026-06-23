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

from app.core.deps import get_current_user, require_permission
from app.database import get_db
from app.models.area import Area as GlobalArea
from app.models.user import User
from app.personal_database import (
    PtcArea,
    PtcCapacitacion,
    PtcCargo,
    PtcEmpresa,
    PtcEvaluacion,
    PtcPersona,
    PtcSancion,
    get_personal_db,
)
from app.services.tc_manual_extraction import (
    cargo_manual_flags,
    extraer_desde_archivo,
    extraer_texto_manual,
    manual_disk_path,
    _sniff_excel_ext,
)

router = APIRouter(prefix="/tc", tags=["T&C Personal"])

require_tc = require_permission("mod_tc")
require_tc_editar = require_permission("mod_tc_editar")
require_tc_sensible = require_permission("mod_tc_sensible")
require_tc_importar = require_permission("mod_tc_importar")
require_tc_or_sig = require_permission("mod_tc", "mod_sig")


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
    area_id: Optional[int] = None
    nombre: str


class CargoUpdate(BaseModel):
    nombre: Optional[str] = None
    area_id: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _persona_dict(p: PtcPersona, db: Session, main_db: Session) -> dict:
    empresa = db.get(PtcEmpresa, p.empresa_id)
    area = main_db.get(GlobalArea, p.area_id) if p.area_id else None
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
        "area_nombre": area.name if area else "",
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


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def stats_globales(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    todas = db.exec(select(PtcPersona)).all()
    activos   = [p for p in todas if p.estado == "Activo"]
    inactivos = [p for p in todas if p.estado != "Activo"]
    con_genero = [p for p in todas if p.genero in ("Masculino", "Femenino")]

    empresas = db.exec(select(PtcEmpresa).order_by(PtcEmpresa.legacy_id)).all()
    por_empresa = []
    for e in empresas:
        emp_personas = [p for p in todas if p.empresa_id == e.id]
        por_empresa.append({
            "id": e.id,
            "codigo": e.codigo,
            "nombre": e.nombre,
            "total": len(emp_personas),
            "activos": sum(1 for p in emp_personas if p.estado == "Activo"),
        })

    return {
        "total":    len(todas),
        "activos":  len(activos),
        "inactivos": len(inactivos),
        "masculino_pct": round(
            sum(1 for p in con_genero if p.genero == "Masculino") / len(con_genero) * 100
            if con_genero else 0
        ),
        "femenino_pct": round(
            sum(1 for p in con_genero if p.genero == "Femenino") / len(con_genero) * 100
            if con_genero else 0
        ),
        "por_empresa": por_empresa,
    }


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
        # Cargos globales: filtrar por los que tienen personas en esta empresa
        cargo_ids_empresa = select(PtcPersona.cargo_id).where(
            PtcPersona.empresa_id == empresa_id,
            PtcPersona.cargo_id.is_not(None),  # type: ignore[union-attr]
        )
        q = q.where(col(PtcCargo.id).in_(cargo_ids_empresa))
    if area_id is not None:
        q = q.where(PtcCargo.area_id == area_id)
    cargos = db.exec(q.order_by(col(PtcCargo.nombre))).all()
    return [
        {
            "id": c.id,
            "area_id": c.area_id,
            "nombre": c.nombre,
            "manual_url": c.manual_url,
            "manual_filename": c.manual_filename,
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
    cargo = PtcCargo(area_id=body.area_id, nombre=nombre)
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return {"id": cargo.id, "area_id": cargo.area_id, "nombre": cargo.nombre}


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
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no puede superar los 20 MB.")

    if ext in ("xlsx", "xls", "xlsm"):
        ext = _sniff_excel_ext(content, ext)
    manuales_dir = "/app/data/tc_manuales"
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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cargo, field, value)
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return {"id": cargo.id, "area_id": cargo.area_id, "nombre": cargo.nombre}


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
        query = query.where(PtcPersona.empresa_id == empresa_id)
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
    return _persona_dict(persona, db, main_db)


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
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar los 5 MB.")

    ext = {"image/png": "png", "image/webp": "webp"}.get(file.content_type, "jpg")
    fotos_dir = "/app/data/tc_fotos"
    os.makedirs(fotos_dir, exist_ok=True)
    with open(os.path.join(fotos_dir, f"{persona_id}.{ext}"), "wb") as f:
        f.write(content)

    persona.foto_url = f"/tc-fotos/{persona_id}.{ext}"
    persona.updated_at = datetime.utcnow()
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return _persona_dict(persona, db, main_db)


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

        # Autocreate cargo global si viene (sin empresa_id)
        cargo_id = None
        if item.cargo_nombre.strip():
            cargo = db.exec(
                select(PtcCargo).where(
                    col(PtcCargo.nombre).ilike(item.cargo_nombre.strip()),
                )
            ).first()
            if not cargo:
                cargo = PtcCargo(area_id=area_id, nombre=item.cargo_nombre.strip())
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


# ── Organigrama ───────────────────────────────────────────────────────────────

@router.get("/organigrama/{empresa_id}")
def obtener_organigrama(
    empresa_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    empresa = db.get(PtcEmpresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    all_areas = main_db.exec(select(GlobalArea).order_by(GlobalArea.name)).all()

    # Todos los cargos globales (no filtrado por empresa)
    cargos_all = db.exec(select(PtcCargo).order_by(col(PtcCargo.nombre))).all()

    # Solo personas activas de esta empresa
    personas_activas = db.exec(
        select(PtcPersona).where(
            PtcPersona.empresa_id == empresa_id,
            PtcPersona.estado == "Activo",
        )
    ).all()

    # cargo_id → personas de ESTA empresa
    por_cargo: dict = {}
    for p in personas_activas:
        if p.cargo_id is not None:
            por_cargo.setdefault(p.cargo_id, []).append({
                "id": p.id,
                "nombre": p.nombre,
                "initials": p.initials or (p.nombre[:2].upper() if p.nombre else "?"),
            })

    # area_id → lista de cargos (todos, personas vacías si no hay asignados en esta empresa)
    por_area: dict = {}
    for c in cargos_all:
        por_area.setdefault(c.area_id, []).append({
            "id": c.id,
            "nombre": c.nombre,
            "personas": por_cargo.get(c.id, []),
        })

    return {
        "empresa": {"id": empresa.id, "nombre": empresa.nombre, "codigo": empresa.codigo},
        "areas": [
            {"id": a.id, "nombre": a.name, "cargos": por_area[a.id]}
            for a in all_areas if a.id in por_area
        ],
        "sin_area": por_area.get(None, []),
    }


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
