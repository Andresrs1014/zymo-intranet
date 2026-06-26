"""
Router T&C — Paquetes de capacitaciones + configuración SMTP.

Prefijo: /tc
  GET    /tc/paquetes               — lista paquetes
  POST   /tc/paquetes               — crear paquete
  PUT    /tc/paquetes/{id}          — actualizar
  DELETE /tc/paquetes/{id}          — soft-delete
  PUT    /tc/paquetes/{id}/items    — reemplazar items
  GET    /tc/smtp-config            — leer config (password oculto)
  PUT    /tc/smtp-config            — guardar config
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.deps import require_permission
from app.models.user import User
from app.personal_database import PtcPaquete, PtcPaqueteItem, PtcSmtpConfig, get_personal_engine

router = APIRouter(prefix="/tc", tags=["T&C Paquetes"])

require_tc        = require_permission("mod_tc")
require_tc_editar = require_permission("mod_tc_editar")


# ── Schemas ───────────────────────────────────────────────────────────────────

class PaqueteBody(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str = Field(default="", max_length=500)
    activo: bool = True


class PaqueteItemBody(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    horas: Optional[float] = None
    orden: int = 0


class SmtpConfigBody(BaseModel):
    host: str = Field(default="", max_length=200)
    port: int = Field(default=587)
    usuario: str = Field(default="", max_length=200)
    password: Optional[str] = None  # None = no modificar
    from_email: str = Field(default="", max_length=200)
    from_nombre: str = Field(default="T&C Zymo", max_length=100)
    activo: bool = False


# ── Helper ────────────────────────────────────────────────────────────────────

def _paquete_dict(p: PtcPaquete, items: list[PtcPaqueteItem]) -> dict:
    return {
        "id": p.id,
        "nombre": p.nombre,
        "descripcion": p.descripcion,
        "activo": p.activo,
        "items": [
            {"id": i.id, "titulo": i.titulo, "horas": i.horas, "orden": i.orden}
            for i in sorted(items, key=lambda x: x.orden)
        ],
    }


# ── Paquetes ──────────────────────────────────────────────────────────────────

@router.get("/paquetes")
def listar_paquetes(_: User = Depends(require_tc)):
    with Session(get_personal_engine()) as db:
        paquetes = db.exec(select(PtcPaquete).where(PtcPaquete.activo == True)).all()  # noqa: E712
        result = []
        for p in paquetes:
            items = db.exec(select(PtcPaqueteItem).where(PtcPaqueteItem.paquete_id == p.id)).all()
            result.append(_paquete_dict(p, list(items)))
        return result


@router.post("/paquetes", status_code=status.HTTP_201_CREATED)
def crear_paquete(body: PaqueteBody, _: User = Depends(require_tc_editar)):
    with Session(get_personal_engine()) as db:
        p = PtcPaquete(nombre=body.nombre, descripcion=body.descripcion, activo=body.activo)
        db.add(p)
        db.commit()
        db.refresh(p)
        return _paquete_dict(p, [])


@router.put("/paquetes/{pid}")
def actualizar_paquete(pid: int, body: PaqueteBody, _: User = Depends(require_tc_editar)):
    with Session(get_personal_engine()) as db:
        p = db.get(PtcPaquete, pid)
        if not p:
            raise HTTPException(status_code=404)
        p.nombre = body.nombre
        p.descripcion = body.descripcion
        p.activo = body.activo
        db.add(p)
        db.commit()
        db.refresh(p)
        items = db.exec(select(PtcPaqueteItem).where(PtcPaqueteItem.paquete_id == pid)).all()
        return _paquete_dict(p, list(items))


@router.delete("/paquetes/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_paquete(pid: int, _: User = Depends(require_tc_editar)):
    with Session(get_personal_engine()) as db:
        p = db.get(PtcPaquete, pid)
        if not p:
            raise HTTPException(status_code=404)
        p.activo = False
        db.add(p)
        db.commit()


@router.put("/paquetes/{pid}/items")
def reemplazar_items(pid: int, items: list[PaqueteItemBody], _: User = Depends(require_tc_editar)):
    with Session(get_personal_engine()) as db:
        p = db.get(PtcPaquete, pid)
        if not p:
            raise HTTPException(status_code=404)
        for old in db.exec(select(PtcPaqueteItem).where(PtcPaqueteItem.paquete_id == pid)).all():
            db.delete(old)
        db.flush()
        new_items = []
        for i, item in enumerate(items):
            ni = PtcPaqueteItem(paquete_id=pid, titulo=item.titulo, horas=item.horas, orden=item.orden or i)
            db.add(ni)
            new_items.append(ni)
        db.commit()
        for ni in new_items:
            db.refresh(ni)
        return _paquete_dict(p, new_items)


# ── SMTP Config ───────────────────────────────────────────────────────────────

@router.get("/smtp-config")
def get_smtp_config(_: User = Depends(require_tc)):
    with Session(get_personal_engine()) as db:
        cfg = db.get(PtcSmtpConfig, 1)
        if not cfg:
            return {"id": 1, "host": "", "port": 587, "usuario": "", "from_email": "", "from_nombre": "T&C Zymo", "activo": False}
        return {
            "id": cfg.id, "host": cfg.host, "port": cfg.port,
            "usuario": cfg.usuario, "from_email": cfg.from_email,
            "from_nombre": cfg.from_nombre, "activo": cfg.activo,
        }


@router.put("/smtp-config")
def set_smtp_config(body: SmtpConfigBody, _: User = Depends(require_tc_editar)):
    with Session(get_personal_engine()) as db:
        cfg = db.get(PtcSmtpConfig, 1)
        if not cfg:
            cfg = PtcSmtpConfig(id=1)
        cfg.host = body.host
        cfg.port = body.port
        cfg.usuario = body.usuario
        if body.password is not None:
            cfg.password = body.password
        cfg.from_email = body.from_email
        cfg.from_nombre = body.from_nombre
        cfg.activo = body.activo
        db.add(cfg)
        db.commit()
        return {"ok": True}
