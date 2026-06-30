"""Router T&C — Clientes corporativos (solo lectura). Prefijo: /tc"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.deps import require_permission
from app.database import get_db
from app.models.user import User
from app.services.clientes_cartera import (
    get_personal_db,
    listar_analistas,
    listar_clientes_response,
)

router = APIRouter(prefix="/tc", tags=["T&C Clientes"])

require_tc = require_permission("mod_tc")


@router.get("/clientes")
def listar_clientes(
    q: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    return listar_clientes_response(db, main_db, q=q, skip=skip, limit=limit)


@router.get("/clientes/analistas")
def listar_analistas_tc(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc),
):
    return listar_analistas(db)


@router.post("/clientes", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
@router.put("/clientes/{cliente_id}", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
@router.delete("/clientes/{cliente_id}", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
@router.post("/clientes/import/excel", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
@router.get("/clientes/plantilla", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
def clientes_solo_operativo():
    raise HTTPException(
        status_code=405,
        detail="La gestión de clientes se realiza en el módulo Operativo.",
    )
