"""
Servicio de memoria persistente para agentes ZYMO.

Carga y actualiza memorias de usuario en la tabla agent_memory.
La memoria se inyecta como contexto en cada turno de chat, permitiendo
que los agentes recuerden preferencias y patrones entre sesiones.

Regla crítica: si hay conflicto entre memoria y dato real de BD → gana la BD.
"""
import json
import logging
from datetime import datetime

from sqlmodel import Session, select

from app.agent_database import AgentMemory

logger = logging.getLogger(__name__)


def cargar_memoria_usuario(user_email: str, db: Session) -> str:
    """
    Carga las memorias del usuario y las formatea como bloque de contexto
    para inyectar antes del mensaje enviado a Gemini.

    Retorna string vacío si no hay memorias o si ocurre un error.
    """
    try:
        memorias = db.exec(
            select(AgentMemory).where(AgentMemory.user_email == user_email)
        ).all()
        if not memorias:
            return ""
        lineas = ["[MEMORIA DE SESIONES ANTERIORES — solo usa esto como contexto, la BD tiene la verdad]"]
        for m in memorias:
            try:
                valor = json.loads(m.valor)
                if isinstance(valor, str):
                    lineas.append(f"- {m.clave}: {valor}")
                else:
                    lineas.append(f"- {m.clave}: {json.dumps(valor, ensure_ascii=False)}")
            except (json.JSONDecodeError, TypeError):
                lineas.append(f"- {m.clave}: {m.valor}")
        return "\n".join(lineas)
    except Exception as e:
        logger.warning("Error cargando memoria para %s: %s", user_email, e)
        return ""


def actualizar_contexto_login(user_email: str, contexto: dict, db: Session) -> None:
    """
    Actualiza (o crea) la entrada 'contexto_ultimo_login' para el usuario.
    Se llama al final de cada sesión de chat para que en el próximo login
    el agente sepa en qué estado quedó el área.
    """
    try:
        mem = db.exec(
            select(AgentMemory)
            .where(AgentMemory.user_email == user_email)
            .where(AgentMemory.clave == "contexto_ultimo_login")
        ).first()
        valor_json = json.dumps(contexto, ensure_ascii=False, default=str)
        if mem:
            mem.valor = valor_json
            mem.updated_at = datetime.utcnow()
        else:
            mem = AgentMemory(
                user_email=user_email,
                clave="contexto_ultimo_login",
                valor=valor_json,
            )
        db.add(mem)
        db.commit()
    except Exception as e:
        logger.warning("Error actualizando contexto_login para %s: %s", user_email, e)
