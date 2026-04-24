"""
Endpoints de configuración financiera — solo admin.
Gestiona el catálogo de TipoGasto y CuentaContable,
y la asignación de cuentas a facturas.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import require_admin, require_financiero
from app.financiero_database import get_financiero_db
from app.models.financiero import CuentaContable, FacturaCuentaContable, FacturaProveedor, TipoGasto
from app.models.user import User

router = APIRouter(tags=["Financiero - Configuración"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TipoGastoRead(BaseModel):
    id: int
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class TipoGastoCreate(BaseModel):
    nombre: str


class CuentaContableRead(BaseModel):
    id: int
    numero_cuenta: str
    nombre_cuenta: str
    tipo_gasto_id: Optional[int]
    tipo_gasto_nombre: Optional[str] = None
    activo: bool

    class Config:
        from_attributes = True


class CuentaContableCreate(BaseModel):
    numero_cuenta: str
    nombre_cuenta: str
    tipo_gasto_id: Optional[int] = None


class CuentaContableUpdate(BaseModel):
    numero_cuenta: Optional[str] = None
    nombre_cuenta: Optional[str] = None
    tipo_gasto_id: Optional[int] = None
    activo: Optional[bool] = None


class FacturaCuentaRead(BaseModel):
    id: int
    factura_id: uuid.UUID
    cuenta_id: int
    numero_cuenta: str
    nombre_cuenta: str
    tipo_gasto_nombre: Optional[str]

    class Config:
        from_attributes = True


class AsignarCuentaPayload(BaseModel):
    cuenta_id: int


# ── Tipos de Gasto ────────────────────────────────────────────────────────────

@router.get("/config/tipos-gasto", response_model=list[TipoGastoRead])
def listar_tipos_gasto(
    _: User = Depends(require_admin),
    fin_db: Session = Depends(get_financiero_db),
):
    return fin_db.exec(select(TipoGasto).order_by(TipoGasto.nombre)).all()


@router.post("/config/tipos-gasto", response_model=TipoGastoRead, status_code=status.HTTP_201_CREATED)
def crear_tipo_gasto(
    payload: TipoGastoCreate,
    _: User = Depends(require_admin),
    fin_db: Session = Depends(get_financiero_db),
):
    existente = fin_db.exec(select(TipoGasto).where(TipoGasto.nombre == payload.nombre)).first()
    if existente:
        raise HTTPException(status_code=409, detail="Ya existe un tipo de gasto con ese nombre.")
    tipo = TipoGasto(nombre=payload.nombre)
    fin_db.add(tipo)
    fin_db.commit()
    fin_db.refresh(tipo)
    return tipo


@router.delete("/config/tipos-gasto/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tipo_gasto(
    tipo_id: int,
    _: User = Depends(require_admin),
    fin_db: Session = Depends(get_financiero_db),
):
    tipo = fin_db.get(TipoGasto, tipo_id)
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de gasto no encontrado.")
    fin_db.delete(tipo)
    fin_db.commit()


# ── Cuentas Contables ─────────────────────────────────────────────────────────

@router.get("/config/cuentas", response_model=list[CuentaContableRead])
def listar_cuentas(
    solo_activas: bool = True,
    _: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
):
    """Lista cuentas contables. Financiero y admin pueden ver para asignar a facturas."""
    query = select(CuentaContable)
    if solo_activas:
        query = query.where(CuentaContable.activo == True)  # noqa: E712
    cuentas = fin_db.exec(query.order_by(CuentaContable.numero_cuenta)).all()

    tipos = {t.id: t.nombre for t in fin_db.exec(select(TipoGasto)).all()}
    return [
        CuentaContableRead(
            id=c.id,
            numero_cuenta=c.numero_cuenta,
            nombre_cuenta=c.nombre_cuenta,
            tipo_gasto_id=c.tipo_gasto_id,
            tipo_gasto_nombre=tipos.get(c.tipo_gasto_id) if c.tipo_gasto_id else None,
            activo=c.activo,
        )
        for c in cuentas
    ]


@router.post("/config/cuentas", response_model=CuentaContableRead, status_code=status.HTTP_201_CREATED)
def crear_cuenta(
    payload: CuentaContableCreate,
    _: User = Depends(require_admin),
    fin_db: Session = Depends(get_financiero_db),
):
    cuenta = CuentaContable(
        numero_cuenta=payload.numero_cuenta.strip(),
        nombre_cuenta=payload.nombre_cuenta.strip(),
        tipo_gasto_id=payload.tipo_gasto_id,
    )
    fin_db.add(cuenta)
    fin_db.commit()
    fin_db.refresh(cuenta)
    tipos = {t.id: t.nombre for t in fin_db.exec(select(TipoGasto)).all()}
    return CuentaContableRead(
        id=cuenta.id,
        numero_cuenta=cuenta.numero_cuenta,
        nombre_cuenta=cuenta.nombre_cuenta,
        tipo_gasto_id=cuenta.tipo_gasto_id,
        tipo_gasto_nombre=tipos.get(cuenta.tipo_gasto_id) if cuenta.tipo_gasto_id else None,
        activo=cuenta.activo,
    )


@router.patch("/config/cuentas/{cuenta_id}", response_model=CuentaContableRead)
def actualizar_cuenta(
    cuenta_id: int,
    payload: CuentaContableUpdate,
    _: User = Depends(require_admin),
    fin_db: Session = Depends(get_financiero_db),
):
    cuenta = fin_db.get(CuentaContable, cuenta_id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cuenta, field, value)
    fin_db.add(cuenta)
    fin_db.commit()
    fin_db.refresh(cuenta)
    tipos = {t.id: t.nombre for t in fin_db.exec(select(TipoGasto)).all()}
    return CuentaContableRead(
        id=cuenta.id,
        numero_cuenta=cuenta.numero_cuenta,
        nombre_cuenta=cuenta.nombre_cuenta,
        tipo_gasto_id=cuenta.tipo_gasto_id,
        tipo_gasto_nombre=tipos.get(cuenta.tipo_gasto_id) if cuenta.tipo_gasto_id else None,
        activo=cuenta.activo,
    )


@router.delete("/config/cuentas/{cuenta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cuenta(
    cuenta_id: int,
    _: User = Depends(require_admin),
    fin_db: Session = Depends(get_financiero_db),
):
    cuenta = fin_db.get(CuentaContable, cuenta_id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")
    fin_db.delete(cuenta)
    fin_db.commit()


# ── Cuentas asignadas a una factura ──────────────────────────────────────────

@router.get("/facturas/{factura_id}/cuentas", response_model=list[FacturaCuentaRead])
def listar_cuentas_factura(
    factura_id: uuid.UUID,
    _: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
):
    asignaciones = fin_db.exec(
        select(FacturaCuentaContable).where(FacturaCuentaContable.factura_id == factura_id)
    ).all()
    if not asignaciones:
        return []

    cuenta_ids = [a.cuenta_id for a in asignaciones]
    cuentas = {
        c.id: c
        for c in fin_db.exec(select(CuentaContable).where(CuentaContable.id.in_(cuenta_ids))).all()
    }
    tipos = {t.id: t.nombre for t in fin_db.exec(select(TipoGasto)).all()}

    return [
        FacturaCuentaRead(
            id=a.id,
            factura_id=a.factura_id,
            cuenta_id=a.cuenta_id,
            numero_cuenta=cuentas[a.cuenta_id].numero_cuenta if a.cuenta_id in cuentas else "—",
            nombre_cuenta=cuentas[a.cuenta_id].nombre_cuenta if a.cuenta_id in cuentas else "—",
            tipo_gasto_nombre=tipos.get(cuentas[a.cuenta_id].tipo_gasto_id) if a.cuenta_id in cuentas and cuentas[a.cuenta_id].tipo_gasto_id else None,
        )
        for a in asignaciones
    ]


@router.post("/facturas/{factura_id}/cuentas", response_model=FacturaCuentaRead, status_code=status.HTTP_201_CREATED)
def asignar_cuenta_factura(
    factura_id: uuid.UUID,
    payload: AsignarCuentaPayload,
    _: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
):
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada.")
    cuenta = fin_db.get(CuentaContable, payload.cuenta_id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta contable no encontrada.")

    # Evitar duplicados
    existente = fin_db.exec(
        select(FacturaCuentaContable).where(
            FacturaCuentaContable.factura_id == factura_id,
            FacturaCuentaContable.cuenta_id == payload.cuenta_id,
        )
    ).first()
    if existente:
        raise HTTPException(status_code=409, detail="Esta cuenta ya está asignada a la factura.")

    asignacion = FacturaCuentaContable(factura_id=factura_id, cuenta_id=payload.cuenta_id)
    fin_db.add(asignacion)
    fin_db.commit()
    fin_db.refresh(asignacion)

    tipo_nombre = None
    if cuenta.tipo_gasto_id:
        tipo = fin_db.get(TipoGasto, cuenta.tipo_gasto_id)
        tipo_nombre = tipo.nombre if tipo else None

    return FacturaCuentaRead(
        id=asignacion.id,
        factura_id=asignacion.factura_id,
        cuenta_id=asignacion.cuenta_id,
        numero_cuenta=cuenta.numero_cuenta,
        nombre_cuenta=cuenta.nombre_cuenta,
        tipo_gasto_nombre=tipo_nombre,
    )


@router.delete("/facturas/{factura_id}/cuentas/{asignacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_cuenta_factura(
    factura_id: uuid.UUID,
    asignacion_id: int,
    _: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
):
    asignacion = fin_db.get(FacturaCuentaContable, asignacion_id)
    if not asignacion or asignacion.factura_id != factura_id:
        raise HTTPException(status_code=404, detail="Asignación no encontrada.")
    fin_db.delete(asignacion)
    fin_db.commit()
