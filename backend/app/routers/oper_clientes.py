"""Router Operativo — Cartera de clientes corporativos. Prefijo: /operativo"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.config import settings
from app.core.deps import get_current_user, require_permission
from app.database import get_db
from app.models.user import User
from app.services.clientes_cartera import (
    ClienteBody,
    ClienteUpdateBody,
    RolTicketBody,
    SedesConfigBody,
    actualizar_cliente,
    crear_cliente,
    eliminar_cliente,
    get_personal_db,
    guardar_rol_ticket,
    guardar_sedes_config,
    importar_excel,
    listar_analistas,
    listar_analistas_para_citas,
    listar_clientes_response,
    listar_clientes_simple,
    listar_cargos_simple,
    listar_personas_con_cargo,
    listar_personas_simple,
    listar_roles_ticket,
    listar_sedes_cartera,
    plantilla_path,
    resolver_jerarquia_tickets,
    resolver_persona_por_plataforma,
)

router = APIRouter(prefix="/operativo", tags=["Operativo Clientes"])

require_oper_clientes = require_permission("mod_oper_clientes")
require_tickets_config = require_permission("mod_tickets_config")


def _is_valid_internal_key(key: Optional[str]) -> bool:
    return bool(key and settings.internal_key and key == settings.internal_key)


# ── Sincronización con Citas (crm_2.0) ───────────────────────────────────────
# Servicio-a-servicio únicamente (X-Internal-Key) — mismo patrón que
# personal.py:/personas/buscar. crm_2.0 la consume para actualizar
# accounts.owner_id de sus empresas de Citas.

@router.get("/cartera/analistas-citas")
def get_analistas_para_citas(
    x_internal_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
):
    if not _is_valid_internal_key(x_internal_key):
        raise HTTPException(status_code=403, detail="Requiere X-Internal-Key válida.")
    return listar_analistas_para_citas(db, main_db)


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


@router.get("/personas/lista-simple")
def get_personas_simple(
    rol: Optional[str] = Query(default=None, description="supervisor | analista | coordinador"),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return listar_personas_simple(db, main_db, rol=rol)


@router.get("/personas/por-plataforma")
def get_persona_por_plataforma(
    plataforma: str = Query(..., min_length=1),
    rol: str = Query(..., description="supervisor | analista | coordinador"),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return resolver_persona_por_plataforma(db, main_db, plataforma, rol)


# ── Curación de roles de ticket (Configuración de Tickets, Zymo Ally) ────────
# Gate mod_tickets_config: solo quien administra la configuración de Tickets
# decide quién puede aparecer como Supervisor/Analista/Coordinador.

@router.get("/personas/candidatos-cargo")
def get_personas_candidatos_cargo(
    q: Optional[str] = Query(default=None, description="Buscar por nombre o documento"),
    area_id: Optional[int] = Query(default=None),
    cargo_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tickets_config),
):
    return listar_personas_con_cargo(db, main_db, q=q, area_id=area_id, cargo_id=cargo_id)


@router.get("/cargos/lista-simple")
def get_cargos_simple(
    area_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tickets_config),
):
    return listar_cargos_simple(db, area_id=area_id)


@router.get("/personas/roles-ticket")
def get_roles_ticket(
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tickets_config),
):
    return listar_roles_ticket(db, main_db)


@router.put("/personas/roles-ticket")
def put_roles_ticket(
    body: RolTicketBody,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tickets_config),
):
    guardar_rol_ticket(db, body.rol, body.persona_ids)
    return {"ok": True}


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
