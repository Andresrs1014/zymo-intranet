"""
Router T&C — Bandeja de aprobaciones (jefe directo).

Prefijo API: /tc/aprobaciones-api (deliberadamente distinto del prefijo de la
página frontend /tc/aprobaciones, mismo gotcha de siempre con la regex de
proxy de nginx — ver /tc/evaluaciones-desempeno).

Permiso propio `mod_tc_aprobaciones` — independiente de mod_tc, mismo patrón
que mod_tc_agenda: un jefe con gente a cargo aprueba sus permisos/novedades
sin necesitar acceso al resto de T&C.

Alcance: solo el JEFE DIRECTO (persona.jefe_directo_id) puede aprobar o
rechazar una novedad de su liderado — a diferencia de _puede_ver_sensible
(personal.py), que sube toda la cadena de mando. Aprobar es una acción, no
solo lectura, y lo pedido fue explícitamente "mi jefe".
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.core.deps import require_permission
from app.models.user import User
from app.personal_database import PtcNovedad, PtcPersona, get_personal_db

log = logging.getLogger(__name__)

router = APIRouter(prefix="/tc/aprobaciones-api", tags=["T&C Aprobaciones"])

require_tc_aprobaciones = require_permission("mod_tc_aprobaciones")


def _resolver_perfil_jefe(user: User, db: Session) -> PtcPersona:
    persona = db.exec(select(PtcPersona).where(PtcPersona.user_id == user.id)).first()
    if not persona:
        raise HTTPException(
            400,
            "Tu usuario no tiene un perfil de colaborador vinculado en T&C — no se puede resolver quién eres como jefe.",
        )
    return persona


def _novedad_de_mi_liderado(novedad_id: int, jefe: PtcPersona, db: Session) -> tuple[PtcNovedad, PtcPersona]:
    nov = db.get(PtcNovedad, novedad_id)
    if not nov:
        raise HTTPException(404, "Solicitud no encontrada.")
    persona = db.get(PtcPersona, nov.persona_id)
    if not persona or persona.jefe_directo_id != jefe.id:
        raise HTTPException(403, "Esta solicitud no pertenece a tu gente a cargo.")
    if nov.estado != "Pendiente":
        raise HTTPException(409, f"Esta solicitud ya fue {nov.estado.lower()}.")
    return nov, persona


# ── Aviso a T&C (fire-and-forget) ──────────────────────────────────────────────

def _notificar_tc(persona_nombre: str, jefe_nombre: str, tipo: str, accion: str) -> None:
    """Corre en background tras el commit — un fallo de correo nunca debe
    afectar la aprobación/rechazo ya guardado. Abre su propia sesión de BD en
    vez de reusar la del request: para cuando un BackgroundTask corre, FastAPI
    ya cerró las sesiones inyectadas por Depends."""
    try:
        from app.core.permissions import role_names_with_permission
        from app.database import get_engine
        from app.models.user import User as MainUser
        from app.services.global_smtp import get_smtp_candidates
        from app.services.tc_email import send_email

        candidates = get_smtp_candidates()
        if not candidates:
            log.warning("[tc_aprobaciones] SMTP corporativo no configurado — omitiendo aviso a T&C")
            return
        smtp = candidates[0]

        with Session(get_engine()) as db:
            roles_tc = role_names_with_permission(db, "mod_tc_sensible")
            destinatarios = db.exec(
                select(MainUser).where(col(MainUser.role).in_(roles_tc), MainUser.is_active == True)  # noqa: E712
            ).all()
        emails = [u.email for u in destinatarios if u.email]
        if not emails:
            log.warning("[tc_aprobaciones] Nadie con mod_tc_sensible tiene correo — omitiendo aviso a T&C")
            return

        verbo = "aprobó" if accion == "aprobada" else "rechazó"
        subject = f"[T&C] Solicitud {accion} — {persona_nombre}"
        body = f"""
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
          <div style="border-left:4px solid #0d9488;padding-left:16px;margin-bottom:16px">
            <h2 style="color:#0d9488;margin:0;font-size:17px">Solicitud {accion}</h2>
            <p style="color:#6b7280;margin:4px 0 0;font-size:12px">Talento y Cultura — ZYMO</p>
          </div>
          <p style="color:#374151;font-size:14px">
            <strong>{jefe_nombre}</strong> {verbo} la solicitud de <strong>{tipo}</strong>
            de <strong>{persona_nombre}</strong>.
          </p>
          <p style="color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px">
            Enviado automáticamente desde la Intranet ZYMO.
          </p>
        </div>
        """
        for to in emails:
            send_email(
                host=smtp["smtp_host"], port=smtp["smtp_port"],
                usuario=smtp["smtp_user"], password=smtp["smtp_password"],
                from_email=smtp["smtp_from"], from_nombre="T&C Zymo",
                to=to, subject=subject, body_html=body,
            )
    except Exception:
        log.exception("[tc_aprobaciones] No se pudo notificar a T&C")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def listar_pendientes(
    db: Session = Depends(get_personal_db),
    user: User = Depends(require_tc_aprobaciones),
):
    jefe = _resolver_perfil_jefe(user, db)
    liderados = db.exec(select(PtcPersona).where(PtcPersona.jefe_directo_id == jefe.id)).all()
    por_id = {p.id: p for p in liderados}
    if not por_id:
        return []

    rows = db.exec(
        select(PtcNovedad)
        .where(col(PtcNovedad.persona_id).in_(por_id.keys()), PtcNovedad.estado == "Pendiente")
        .order_by(col(PtcNovedad.created_at).asc())
    ).all()
    return [
        {
            "id": n.id,
            "persona_id": n.persona_id,
            "persona_nombre": por_id[n.persona_id].nombre,
            "tipo": n.tipo,
            "descripcion": n.descripcion,
            "fecha_inicio": n.fecha_inicio.isoformat() if n.fecha_inicio else None,
            "fecha_fin": n.fecha_fin.isoformat() if n.fecha_fin else None,
            "origen": n.origen,
            "created_at": n.created_at.isoformat(),
        }
        for n in rows
    ]


class RechazarBody(BaseModel):
    motivo: str = ""


@router.post("/{novedad_id}/aprobar")
def aprobar(
    novedad_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_personal_db),
    user: User = Depends(require_tc_aprobaciones),
):
    jefe = _resolver_perfil_jefe(user, db)
    nov, persona = _novedad_de_mi_liderado(novedad_id, jefe, db)
    if not jefe.firma_url:
        raise HTTPException(400, "Tu perfil de T&C no tiene firma digital registrada — agrégala antes de aprobar.")

    nov.estado = "Aprobado"
    nov.aprobador_persona_id = jefe.id
    nov.firma_aprobador_url = jefe.firma_url
    nov.aprobado_en = datetime.utcnow()
    db.add(nov)
    db.commit()
    db.refresh(nov)

    background_tasks.add_task(_notificar_tc, persona.nombre, jefe.nombre, nov.tipo, "aprobada")
    return {"id": nov.id, "estado": nov.estado, "firma_aprobador_url": nov.firma_aprobador_url}


@router.post("/{novedad_id}/rechazar")
def rechazar(
    novedad_id: int,
    body: RechazarBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_personal_db),
    user: User = Depends(require_tc_aprobaciones),
):
    jefe = _resolver_perfil_jefe(user, db)
    nov, persona = _novedad_de_mi_liderado(novedad_id, jefe, db)

    nov.estado = "Rechazado"
    nov.aprobador_persona_id = jefe.id
    nov.aprobado_en = datetime.utcnow()
    if body.motivo.strip():
        nov.descripcion = f"{nov.descripcion}\nMotivo de rechazo: {body.motivo.strip()}".strip()
    db.add(nov)
    db.commit()
    db.refresh(nov)

    background_tasks.add_task(_notificar_tc, persona.nombre, jefe.nombre, nov.tipo, "rechazada")
    return {"id": nov.id, "estado": nov.estado}
