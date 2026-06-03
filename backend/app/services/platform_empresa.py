"""Nombre comercial de la empresa según plataforma (lee platforms/*/config.json).

Este módulo es la fuente de verdad del mapa plataforma→slug.
email_service.py y documentos.py importan SLUG_MAP desde aquí.
Para agregar una plataforma nueva basta editar este archivo.
"""
import json
from pathlib import Path
from typing import Optional

_PLATFORMS_DIR = Path(__file__).resolve().parent.parent / "platforms"

# Fuente de verdad única. email_service y documentos importan desde aquí.
SLUG_MAP: dict[str, str] = {
    "logimat": "logimat",
    "logimat 2": "logimat",
    "logimat2": "logimat",
    "logimat s.a.s.": "logimat",
    "imccargo": "imccargo",
    "imc cargo": "imccargo",
    "imc cargo international": "imccargo",
    "imc cargo international s.a.s.": "imccargo",
    "imcdep": "imcdep",
    "imc deposito": "imcdep",
    "imc depósito": "imcdep",
    "imc deposito s.a.s.": "imcdep",
    "imc depósito s.a.s.": "imcdep",
}

# Alias privado para compatibilidad interna
_SLUG_MAP = SLUG_MAP


def nombre_empresa_desde_plataforma(plataforma: Optional[str]) -> Optional[str]:
    slug = _SLUG_MAP.get((plataforma or "").lower().strip())
    if slug is None:
        return None
    config_path = _PLATFORMS_DIR / slug / "config.json"
    if not config_path.exists():
        return None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    name = cfg.get("nombre")
    return str(name).strip() if name else None
