"""Deja creadas, de una vez, las áreas que la intranet necesita. Idempotente y SOLO agrega: no renombra ni borra nada.

Compara sin distinguir mayúsculas ni tildes, para no crear «Planeación y consultoria» al lado de «Planeación y Consultoria».
Uso (dentro del contenedor backend):
  docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python - [--aplicar]" < backend/scripts/areas_faltantes.py
  (sin opciones = solo muestra qué crearía)
"""
import sys
import unicodedata

from sqlmodel import Session, select

from app.database import get_engine
from app.models.area import Area

# Las 14 áreas REALES: las carpetas del SIG de producción, con su nombre tal cual (2026-10-15). Son áreas distintas entre sí
# y distintas de las demás de la intranet: NO se unifican. «OPERACIONES IMDE» del SIG se corrige a «Operaciones IMCD» (error de
# escritura; en el SIG se renombra aparte). Las áreas que la intranet ya tiene de más (Operaciones IMCCARGO, Sistemas de Gestión,
# Comercial, Compras, Finanzas…) NO se tocan.
ESPERADAS = [
    "Administrativo", "Control y Seguridad", "Desarrollo e innovación", "Financiera", "IT Soporte",
    "Operaciones IMCC", "Operaciones IMCD", "Operaciones Logimat", "Planeación y Consultoria",
    "Proyectos y Negocios", "SIG", "Servicio al Cliente", "Talento y Cultura", "Transporte",
]
APLICAR = "--aplicar" in sys.argv[1:]


def clave(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn").strip()


with Session(get_engine()) as db:
    hay = {clave(a.name) for a in db.exec(select(Area)).all()}
    faltan = [n for n in ESPERADAS if clave(n) not in hay]
    for n in faltan:
        print(("CREA   " if APLICAR else "crearía ") + n)
        if APLICAR:
            db.add(Area(name=n))
    if APLICAR:
        db.commit()
    print(f"\n{len(faltan)} áreas por crear de {len(ESPERADAS)} esperadas." + ("" if APLICAR else " (simulación; usa --aplicar)"))
