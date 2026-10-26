"""Consecutivos de OC (OS-AAAA-XXXX, OC-AAAA-XXXX): por defecto nunca se reutilizan."""

from __future__ import annotations

from sqlmodel import Session, select

from app.models.oc import OcConfig


def _leer(oc_db: Session, clave: str) -> str:
    fila = oc_db.get(OcConfig, clave)
    return fila.value if fila else ""


def _guardar(oc_db: Session, clave: str, valor: str) -> None:
    fila = oc_db.get(OcConfig, clave)
    if fila:
        fila.value = valor
        oc_db.add(fila)
    else:
        oc_db.add(OcConfig(key=clave, value=valor))


def siguiente_consecutivo(oc_db: Session, prefijo: str, columna) -> str:
    """Devuelve el siguiente número libre para `prefijo` (ej. "OS-2026-").

    Primero usa el menor número liberado a propósito (ver `liberar_consecutivo`); si no hay, toma el mayor
    entre el último número entregado (guardado en oc_config, sobrevive a borrados) y el mayor existente en
    `columna`, más uno. No hace commit: lo confirma quien inserta la fila, y si esa inserción falla el
    rollback también deshace el contador.
    """
    ocupados = {
        int(e[len(prefijo):])
        for e in oc_db.exec(select(columna).where(columna.startswith(prefijo))).all()
        if e[len(prefijo):].isdigit()
    }
    clave_liberados = f"consecutivo_liberados:{prefijo}"
    liberados = sorted({int(n) for n in _leer(oc_db, clave_liberados).split(",") if n.isdigit()} - ocupados)
    if liberados:
        elegido, restantes = liberados[0], liberados[1:]
        _guardar(oc_db, clave_liberados, ",".join(map(str, restantes)))
        return f"{prefijo}{elegido:04d}"

    clave = f"consecutivo:{prefijo}"
    ultimo = _leer(oc_db, clave)
    siguiente = max(int(ultimo) if ultimo.isdigit() else 0, max(ocupados, default=0)) + 1
    _guardar(oc_db, clave, str(siguiente))
    return f"{prefijo}{siguiente:04d}"


def liberar_consecutivo(oc_db: Session, numero: str) -> None:
    """Deja `numero` (ej. "OS-2026-0007") disponible para volver a usarse. Solo para pruebas."""
    prefijo, _, sufijo = numero.rpartition("-")
    if not sufijo.isdigit():
        return
    prefijo += "-"
    clave = f"consecutivo_liberados:{prefijo}"
    actuales = {n for n in _leer(oc_db, clave).split(",") if n.isdigit()}
    actuales.add(str(int(sufijo)))
    _guardar(oc_db, clave, ",".join(sorted(actuales, key=int)))
