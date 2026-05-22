from __future__ import annotations
from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlmodel import Session
    from app.models.user import User
    from app.schemas.task_event import TaskEventCreate


def _parse_hhmm(hhmm: str) -> int:
    """Convierte 'HH:MM' a minutos desde medianoche."""
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _events_overlap(start1: int, dur1: int, start2: int, dur2: int) -> bool:
    """True si dos intervalos [start, start+dur) se solapan."""
    end1 = start1 + dur1
    end2 = start2 + dur2
    return start1 < end2 and start2 < end1


def create_event(
    db: "Session",
    creator: "User",
    payload: "TaskEventCreate",
) -> dict:
    """
    Crea un TaskEvent con sus participantes.
    Para cada participante verifica si tiene conflicto de horario en la misma fecha.
    Retorna el evento con la lista de participantes y sus flags de conflicto.
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from app.models.user import User as UserModel
    from sqlmodel import select

    event = TaskEvent(
        owner_user_id=creator.id,
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        plataforma=payload.plataforma,
        prioridad=getattr(payload, "prioridad", None),
        modalidad=getattr(payload, "modalidad", None),
        sede=getattr(payload, "sede", None),
        fecha=date.fromisoformat(payload.fecha),
        hora_inicio=payload.hora_inicio,
        duracion_minutos=payload.duracion_minutos,
        creado_por_id=creator.id,
        creado_por_nombre=creator.full_name or creator.email,
    )
    db.add(event)
    db.flush()  # Obtener event.id sin hacer commit aún

    new_start = _parse_hhmm(payload.hora_inicio)
    new_dur = payload.duracion_minutos
    participants = []

    for uid in payload.participant_ids:
        user = db.get(UserModel, uid)
        if not user:
            continue

        # Buscar eventos existentes del usuario en la misma fecha
        existing = db.exec(
            select(TaskEvent)
            .join(TaskEventParticipant, TaskEvent.id == TaskEventParticipant.event_id)
            .where(
                TaskEventParticipant.user_id == uid,
                TaskEvent.fecha == date.fromisoformat(payload.fecha),
                TaskEvent.id != event.id,
            )
        ).all()

        has_conflict = False
        conflict_detail = None
        for ex in existing:
            ex_start = _parse_hhmm(ex.hora_inicio)
            if _events_overlap(new_start, new_dur, ex_start, ex.duracion_minutos):
                has_conflict = True
                conflict_detail = f"Choca con: '{ex.titulo}' a las {ex.hora_inicio}"
                break

        participant = TaskEventParticipant(
            event_id=event.id,
            user_id=uid,
            user_nombre=user.full_name or user.email,
            has_conflict=has_conflict,
            conflict_detail=conflict_detail,
        )
        db.add(participant)
        participants.append(participant)

    db.commit()
    db.refresh(event)

    return {
        "event": event,
        "participants": participants,
    }


def get_events_by_date(db: "Session", fecha: str, user_id: int | None = None) -> list:
    """
    Devuelve eventos de una fecha.
    Si user_id es None → todos (vista gestor).
    Si user_id es int → solo los del usuario (vista colaborador).
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from sqlmodel import select

    fecha_date = date.fromisoformat(fecha)

    if user_id is None:
        events = db.exec(
            select(TaskEvent).where(
                TaskEvent.fecha == fecha_date,
            ).order_by(TaskEvent.hora_inicio)
        ).all()
    else:
        events = db.exec(
            select(TaskEvent)
            .join(TaskEventParticipant, TaskEvent.id == TaskEventParticipant.event_id)
            .where(
                TaskEvent.fecha == fecha_date,
                TaskEventParticipant.user_id == user_id,
            )
            .order_by(TaskEvent.hora_inicio)
        ).all()

    event_ids = [ev.id for ev in events]
    if event_ids:
        all_parts = db.exec(
            select(TaskEventParticipant).where(
                TaskEventParticipant.event_id.in_(event_ids)
            )
        ).all()
    else:
        all_parts = []

    parts_by_event: dict[int, list] = {}
    for p in all_parts:
        parts_by_event.setdefault(p.event_id, []).append(p)

    return [{"event": ev, "participants": parts_by_event.get(ev.id, [])} for ev in events]


def delete_event(db: "Session", event_id: int, requesting_user_id: int, is_manager: bool) -> None:
    """
    Deletes an event and all its participants.
    Only the event creator or a manager can delete.
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from fastapi import HTTPException
    from sqlmodel import select as sqlmodel_select

    event = db.get(TaskEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    if not is_manager and event.creado_por_id != requesting_user_id:
        raise HTTPException(status_code=403, detail="Solo el creador o un gestor puede cancelar este evento.")

    participants = db.exec(
        sqlmodel_select(TaskEventParticipant).where(TaskEventParticipant.event_id == event_id)
    ).all()
    for p in participants:
        db.delete(p)
    db.delete(event)
    db.commit()


def update_event_participants(
    db: "Session",
    event_id: int,
    requesting_user_id: int,
    is_manager: bool,
    add_ids: list[int],
    remove_ids: list[int],
) -> dict:
    """
    Adds or removes participants from an existing event.
    Only creator or manager can modify participants.
    Re-runs conflict detection for added users.
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from app.models.user import User as UserModel
    from fastapi import HTTPException
    from sqlmodel import select as sqlmodel_select

    event = db.get(TaskEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    if not is_manager and event.creado_por_id != requesting_user_id:
        raise HTTPException(status_code=403, detail="Solo el creador o un gestor puede modificar participantes.")

    # Remove participants
    for uid in remove_ids:
        existing = db.exec(
            sqlmodel_select(TaskEventParticipant)
            .where(TaskEventParticipant.event_id == event_id)
            .where(TaskEventParticipant.user_id == uid)
        ).first()
        if existing:
            db.delete(existing)

    # Flush deletes so the "already present" check below doesn't see stale rows.
    db.flush()

    # Add participants (skip if already present)
    new_start = _parse_hhmm(event.hora_inicio)
    new_dur = event.duracion_minutos

    for uid in add_ids:
        already = db.exec(
            sqlmodel_select(TaskEventParticipant)
            .where(TaskEventParticipant.event_id == event_id)
            .where(TaskEventParticipant.user_id == uid)
        ).first()
        if already:
            continue

        user = db.get(UserModel, uid)
        if not user:
            continue

        existing_events = db.exec(
            sqlmodel_select(TaskEvent)
            .join(TaskEventParticipant, TaskEvent.id == TaskEventParticipant.event_id)
            .where(
                TaskEventParticipant.user_id == uid,
                TaskEvent.fecha == event.fecha,
                TaskEvent.id != event_id,
            )
        ).all()

        has_conflict = False
        conflict_detail = None
        for ex in existing_events:
            ex_start = _parse_hhmm(ex.hora_inicio)
            if _events_overlap(new_start, new_dur, ex_start, ex.duracion_minutos):
                has_conflict = True
                conflict_detail = f"Choca con: '{ex.titulo}' a las {ex.hora_inicio}"
                break

        participant = TaskEventParticipant(
            event_id=event_id,
            user_id=uid,
            user_nombre=user.full_name or user.email,
            has_conflict=has_conflict,
            conflict_detail=conflict_detail,
        )
        db.add(participant)

    db.commit()

    # Return refreshed participants list
    participants = db.exec(
        sqlmodel_select(TaskEventParticipant).where(TaskEventParticipant.event_id == event_id)
    ).all()
    return {
        "event": event,
        "participants": list(participants),
    }
