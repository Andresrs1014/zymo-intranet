"""Consecutivos de OC (OS-AAAA-XXXX, OC-AAAA-XXXX) que nunca se reutilizan."""

from __future__ import annotations

from sqlmodel import Session, select

from app.models.oc import OcConfig


def siguiente_consecutivo(oc_db: Session, prefijo: str, columna) -> str:
    """Devuelve el siguiente número libre para `prefijo` (ej. "OS-2026-").

    Toma el mayor entre el último número entregado (guardado en oc_config, sobrevive a borrados) y el
    mayor existente en `columna`. Deja el contador actualizado en la sesión sin hacer commit: lo confirma
    quien inserta la fila, y si esa inserción falla el rollback también lo deshace.
    """
    clave = f"consecutivo:{prefijo}"
    fila = oc_db.get(OcConfig, clave)
    ultimo = int(fila.value) if fila and fila.value.isdigit() else 0
    for existente in oc_db.exec(select(columna).where(columna.startswith(prefijo))).all():
        sufijo = existente[len(prefijo):]
        if sufijo.isdigit():
            ultimo = max(ultimo, int(sufijo))
    siguiente = ultimo + 1
    if fila:
        fila.value = str(siguiente)
        oc_db.add(fila)
    else:
        oc_db.add(OcConfig(key=clave, value=str(siguiente)))
    return f"{prefijo}{siguiente:04d}"
