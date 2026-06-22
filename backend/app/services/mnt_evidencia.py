"""Evidencia fotográfica — interno vs externo (antes/después)."""
from typing import Optional


def fase_externo(sol) -> Optional[str]:
    if sol.modalidad != "externo":
        return None
    if getattr(sol, "evidencia_despues_url", None):
        return "evidencia_completa"
    if getattr(sol, "evidencia_antes_url", None) or getattr(sol, "evidencia_url", None):
        return "en_proveedor"
    return "sin_antes"


def evidencia_antes_de(sol) -> Optional[str]:
    return getattr(sol, "evidencia_antes_url", None) or getattr(sol, "evidencia_url", None)


def puede_completar(sol) -> tuple[bool, str]:
    if sol.modalidad == "externo":
        if not evidencia_antes_de(sol):
            return False, "Falta evidencia fotográfica inicial (antes) del mantenimiento externo."
        if not getattr(sol, "evidencia_despues_url", None):
            return False, (
                "Para completar un mantenimiento externo debe subir la foto de evidencia "
                "después del servicio del proveedor."
            )
        return True, ""
    if not getattr(sol, "evidencia_url", None):
        return False, "Para completar el mantenimiento debe subir una foto de evidencia del trabajo realizado."
    return True, ""


def registrar_evidencia_externa(sol, tipo: str, url: str) -> None:
    if tipo == "antes":
        sol.evidencia_antes_url = url
        if not sol.evidencia_url:
            sol.evidencia_url = url
    elif tipo == "despues":
        sol.evidencia_despues_url = url
    else:
        raise ValueError("tipo inválido")
