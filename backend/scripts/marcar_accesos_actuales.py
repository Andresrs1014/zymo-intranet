"""Deja marcados, como permiso de la persona, los accesos que HOY ya tiene por su rol o por su área histórica.

Así, cuando los permisos pasen a darse por persona, nadie pierde lo que ya veía. No quita nada y no cambia lo que cada
persona puede hacer hoy: solo agrega filas en `usuario_permiso` (idempotente).

Uso (dentro del contenedor backend):
  docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python - [opciones]" < backend/scripts/marcar_accesos_actuales.py
  (sin opciones = solo muestra qué marcaría)
  --aplicar               escribe las filas
  --permisos a,b,c        por defecto: mod_financiero,mod_oc_ver,mod_oc_aprobar,mod_oc_config
  --revertir archivo.json borra EXACTAMENTE las filas que una corrida anterior agregó (el archivo lo escribe --aplicar)
Los administradores no se marcan: ya lo ven todo por su rol.
"""
import json
import sys
from datetime import datetime

from sqlmodel import Session, select

from app.core.permissions import _legacy_area_grants, _role_permission_set
from app.database import get_engine
from app.models.area_acceso import UsuarioPermiso
from app.models.user import User

args = sys.argv[1:]  # con `python - opciones` (stdin), argv[0] es "-"


def opcion(nombre: str, defecto: str | None = None) -> str | None:
    return args[args.index(nombre) + 1] if nombre in args and args.index(nombre) + 1 < len(args) else defecto


PERMISOS = (opcion("--permisos") or "mod_financiero,mod_oc_ver,mod_oc_aprobar,mod_oc_config").split(",")
APLICAR = "--aplicar" in args
REVERTIR = opcion("--revertir")

with Session(get_engine()) as db:
    if REVERTIR:
        filas = json.load(open(REVERTIR, encoding="utf8"))
        borradas = 0
        for f in filas:
            fila = db.exec(select(UsuarioPermiso).where(UsuarioPermiso.user_id == f["user_id"], UsuarioPermiso.permiso == f["permiso"])).first()
            if fila:
                db.delete(fila)
                borradas += 1
        db.commit()
        print(f"Revertido: {borradas} de {len(filas)} filas borradas.")
        raise SystemExit(0)

    nuevas, ya_estaban = [], 0
    for u in db.exec(select(User).where(User.is_active == True).order_by(User.id)).all():  # noqa: E712
        if u.role == "admin":
            continue
        por_rol = _role_permission_set(db, u.role)
        for p in PERMISOS:
            if p not in por_rol and not _legacy_area_grants(u, p):
                continue  # hoy no lo tiene: no se le da nada nuevo
            if db.exec(select(UsuarioPermiso).where(UsuarioPermiso.user_id == u.id, UsuarioPermiso.permiso == p)).first():
                ya_estaban += 1
                continue
            origen = "rol" if p in por_rol else "área histórica"
            nuevas.append({"user_id": u.id, "nombre": u.full_name, "rol": u.role, "area": u.area, "permiso": p, "origen": origen})

    for f in nuevas:
        print(f"{'MARCA' if APLICAR else 'marcaría'}  #{f['user_id']:<3} {f['nombre'][:30]:30} rol={f['rol']:14} {f['permiso']:16} (hoy por {f['origen']})")
    print(f"\n{len(nuevas)} filas nuevas, {ya_estaban} ya estaban. Permisos: {', '.join(PERMISOS)}.")
    if APLICAR and nuevas:
        for f in nuevas:
            db.add(UsuarioPermiso(user_id=f["user_id"], permiso=f["permiso"]))
        db.commit()
        archivo = f"/tmp/marcados-{datetime.now():%Y%m%d-%H%M%S}.json"
        json.dump(nuevas, open(archivo, "w", encoding="utf8"), ensure_ascii=False, indent=2)
        print(f"Listo. Para deshacer: --revertir {archivo}")
    elif not APLICAR:
        print("(simulación: no se escribió nada; usa --aplicar para marcar)")
