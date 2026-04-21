import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator

import google.generativeai as genai
from sqlmodel import Session

from app.agent_database import AgentAction, AgentSession, get_agents_engine
from app.config import settings

logger = logging.getLogger(__name__)


class BaseAgent:
    """Clase base para todos los agentes ZYMO."""

    nombre: str = "base"
    modelo: str = "gemini-2.0-flash"

    def __init__(self, api_key: str) -> None:
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(self.modelo)
        self._session_id: str | None = None
        self._user_email: str | None = None

    # ── Sesión ─────────────────────────────────────────────────────────────────

    def iniciar_sesion(self, user_id: int, user_email: str) -> str:
        sesion = AgentSession(
            user_id=user_id,
            user_email=user_email,
            agente=self.nombre,
        )
        with Session(get_agents_engine()) as db:
            db.add(sesion)
            db.commit()
            db.refresh(sesion)
        self._session_id = sesion.id
        self._user_email = user_email
        self._guardar_log_inicio(user_email)
        return sesion.id

    def cerrar_sesion(self, resumen: str = "", tokens: int = 0) -> None:
        if not self._session_id:
            return
        with Session(get_agents_engine()) as db:
            sesion = db.get(AgentSession, self._session_id)
            if sesion:
                sesion.fin = datetime.utcnow()
                sesion.resumen = resumen
                sesion.tokens_usados = tokens
                db.add(sesion)
                db.commit()

    # ── Acciones ───────────────────────────────────────────────────────────────

    def registrar_accion(self, tipo: str, input_text: str, output_text: str, tokens: int = 0) -> None:
        if not self._session_id:
            return
        accion = AgentAction(
            session_id=self._session_id,
            tipo=tipo,
            input=input_text,
            output=output_text,
            modelo_usado=self.modelo,
            tokens=tokens,
        )
        with Session(get_agents_engine()) as db:
            db.add(accion)
            db.commit()

    # ── Chat ───────────────────────────────────────────────────────────────────

    async def chat(self, mensaje: str, historial: list[dict] | None = None) -> str:
        try:
            chat = self._model.start_chat(history=self._convertir_historial(historial))
            respuesta = await chat.send_message_async(mensaje)
            texto = respuesta.text
            self.registrar_accion("respuesta", mensaje, texto)
            return texto
        except Exception as e:
            logger.error("Error en %s.chat: %s", self.nombre, e)
            raise

    async def chat_stream(self, mensaje: str, historial: list[dict] | None = None) -> AsyncGenerator[str, None]:
        try:
            chat = self._model.start_chat(history=self._convertir_historial(historial))
            respuesta = await chat.send_message_async(mensaje, stream=True)
            texto_completo = []
            async for chunk in respuesta:
                if chunk.text:
                    texto_completo.append(chunk.text)
                    yield chunk.text
            self.registrar_accion("respuesta", mensaje, "".join(texto_completo))
        except Exception as e:
            logger.error("Error en %s.chat_stream: %s", self.nombre, e)
            raise

    # ── Markdowns de sesión ────────────────────────────────────────────────────

    def _guardar_log_inicio(self, user_email: str) -> None:
        logs_dir = Path(settings.agent_logs_dir) / self.nombre
        logs_dir.mkdir(parents=True, exist_ok=True)
        fecha = datetime.utcnow().strftime("%Y-%m-%d")
        usuario_safe = user_email.replace("@", "_").replace(".", "_")
        ruta = logs_dir / f"{fecha}_{usuario_safe}_001.md"
        contenido = (
            f"# Sesión {self.nombre} — {fecha} — {user_email}\n"
            f"**Inicio:** {datetime.utcnow().isoformat()}\n\n"
            "## Conversación\n\n"
        )
        ruta.write_text(contenido, encoding="utf-8")

    # ── Utilidades ─────────────────────────────────────────────────────────────

    @staticmethod
    def _convertir_historial(historial: list[dict] | None) -> list[dict]:
        if not historial:
            return []
        resultado = []
        for msg in historial:
            rol = "user" if msg.get("role") == "user" else "model"
            resultado.append({"role": rol, "parts": [msg.get("content", "")]})
        return resultado

    @staticmethod
    def _json(data: Any) -> str:
        return json.dumps(data, ensure_ascii=False, default=str)
