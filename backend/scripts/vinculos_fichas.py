"""Diagnóstico y corrección de fichas del directorio vinculadas a la cuenta equivocada.

Por defecto SOLO MUESTRA (no escribe nada). Con --aplicar suelta las fichas sospechosas y vuelve a enlazar las que tienen una
cuenta clara. Ejecutar dentro del contenedor del backend:

    docker compose exec -T backend python scripts/vinculos_fichas.py            # simulacro
    docker compose exec -T backend python scripts/vinculos_fichas.py --aplicar  # escribe

Una ficha es SOSPECHOSA si el nombre de la ficha no se parece al de la cuenta (menos de 2 palabras en común, sin tildes ni orden).
Se propone enlazarla a otra cuenta activa solo si hay UNA cuenta con ≥2 palabras en común y esa cuenta aún no tiene ficha.
"""
import re
import sys
import unicodedata

from sqlmodel import Session, select

from app.database import get_engine
from app.models.area import Area
from app.models.user import User
from app.personal_database import PtcPersona, get_personal_engine


def palabras(s: str | None) -> set[str]:
    s = unicodedata.normalize("NFD", s or "").lower()
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return {t for t in re.split(r"[^a-z0-9]+", s) if len(t) > 2}


def parecen(a: set[str], b: set[str]) -> bool:
    c = len(a & b)
    return c >= 2 or (c >= 1 and min(len(a), len(b)) <= 2)


def main(aplicar: bool) -> None:
    with Session(get_engine()) as db:
        cuentas = {u.id: u for u in db.exec(select(User).where(User.is_active == True)).all()}  # noqa: E712
        areas = {a.id: a.name for a in db.exec(select(Area)).all()}
    nombre_cuenta = {uid: palabras(u.full_name or u.email.split("@")[0]) for uid, u in cuentas.items()}

    with Session(get_personal_engine()) as pdb:
        vinculadas = pdb.exec(select(PtcPersona).where(PtcPersona.user_id.is_not(None))).all()  # type: ignore[union-attr]
        sospechosas = [p for p in vinculadas if p.user_id in cuentas and not parecen(nombre_cuenta[p.user_id], palabras(p.nombre))]
        conservadas = {p.user_id for p in vinculadas if p.user_id in cuentas and p not in sospechosas}
        libres = {uid for uid in cuentas if uid not in conservadas}  # cuentas que se quedarían sin ficha

        print(f"fichas vinculadas a cuentas activas: {len(vinculadas)} | sospechosas: {len(sospechosas)}\n")
        acciones: list[tuple[PtcPersona, int | None]] = []
        for p in sorted(sospechosas, key=lambda x: (x.user_id, x.id)):
            candidatas = [uid for uid in libres if len(nombre_cuenta[uid] & palabras(p.nombre)) >= 2]
            nuevo = candidatas[0] if len(candidatas) == 1 else None
            if nuevo:
                libres.discard(nuevo)
            acciones.append((p, nuevo))
            actual = cuentas[p.user_id]
            destino = f"-> enlazar a «{cuentas[nuevo].full_name}» (#{nuevo})" if nuevo else "-> soltar (sin cuenta clara)"
            print(f"  ficha #{p.id:<4} {p.nombre[:38]:<38} área {str(areas.get(p.area_id)):<24} hoy en «{actual.full_name}» (#{actual.id})  {destino}")

        if not aplicar:
            print("\nSimulacro: no se escribió nada. Revisa la lista y ejecuta con --aplicar.")
            return
        for p, nuevo in acciones:
            p.user_id = nuevo
            pdb.add(p)
        pdb.commit()
        repetidas = {}
        for p in pdb.exec(select(PtcPersona).where(PtcPersona.user_id.is_not(None))).all():  # type: ignore[union-attr]
            repetidas.setdefault(p.user_id, []).append(p.id)
        malas = {u: f for u, f in repetidas.items() if len(f) > 1}
        print(f"\nAplicado: {len(acciones)} fichas corregidas. Cuentas que siguen con más de una ficha: {malas or 'ninguna'}")


if __name__ == "__main__":
    main("--aplicar" in sys.argv)
