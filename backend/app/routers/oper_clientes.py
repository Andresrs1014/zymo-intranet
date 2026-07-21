"""Router Operativo — Cartera de clientes corporativos. Prefijo: /operativo"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.core.deps import get_current_user, require_permission
from app.database import get_db
from app.models.user import User
from app.services.clientes_cartera import (
    ClienteBody,
    ClienteUpdateBody,
    SedesConfigBody,
    actualizar_cliente,
    crear_cliente,
    eliminar_cliente,
    get_personal_db,
    guardar_sedes_config,
    importar_excel,
    listar_analistas,
    listar_clientes_response,
    listar_clientes_simple,
    listar_sedes_cartera,
    plantilla_path,
    resolver_jerarquia_tickets,
)

router = APIRouter(prefix="/operativo", tags=["Operativo Clientes"])

require_oper_clientes = require_permission("mod_oper_clientes")


# ── Lecturas livianas para el formulario de tickets (Zymo Ally) ──────────────
# Sin gate de mod_oper_clientes: cualquier usuario autenticado que cree
# tickets necesita ver la lista de clientes y resolver su jerarquía, no solo
# quien administra la Cartera de Clientes.

@router.get("/clientes/lista-simple")
def get_clientes_simple(
    db: Session = Depends(get_personal_db),
    _: User = Depends(get_current_user),
):
    return listar_clientes_simple(db)


@router.get("/clientes/{cliente_id}/jerarquia-tickets")
def get_jerarquia_tickets(
    cliente_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return resolver_jerarquia_tickets(cliente_id, db, main_db)


@router.get("/clientes")
def listar_clientes(
    q: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_oper_clientes),
):
    return listar_clientes_response(db, main_db, q=q, skip=skip, limit=limit)


@router.get("/clientes/sedes")
def obtener_sedes_cartera(
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_oper_clientes),
):
    return listar_sedes_cartera(main_db, db)


@router.put("/clientes/sedes")
def actualizar_sedes_cartera(
    body: SedesConfigBody,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_oper_clientes),
):
    return guardar_sedes_config(body, db, main_db)


@router.post("/clientes", status_code=status.HTTP_201_CREATED)
def post_cliente(
    body: ClienteBody,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_oper_clientes),
):
    return crear_cliente(body, db, main_db)


@router.put("/clientes/{cliente_id}")
def put_cliente(
    cliente_id: int,
    body: ClienteUpdateBody,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_oper_clientes),
):
    return actualizar_cliente(cliente_id, body, db, main_db)


@router.delete("/clientes/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cliente(
    cliente_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_oper_clientes),
):
    eliminar_cliente(cliente_id, db)


@router.get("/clientes/plantilla")
def descargar_plantilla(_: User = Depends(require_oper_clientes)):
    path = plantilla_path()
    if not path.is_file():
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Plantilla no disponible.")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="Plantilla_Cargue_Clientes.xlsx",
    )


@router.post("/clientes/import/excel")
async def importar_clientes(
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_oper_clientes),
):
    return await importar_excel(file, db)


@router.get("/clientes/analistas")
def get_analistas(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_oper_clientes),
):
    return listar_analistas(db)
