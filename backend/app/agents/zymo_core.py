"""
ZYMO Core — Agente orquestador principal.

Usa API Key 1 (cuenta Google #1 — GEMINI_API_KEY_GERENCIAL).
Supervisa al Agente Administrativo cada 2 horas.
Disponible 24/7 para el gerente y Andrés.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator

import google.generativeai as genai

from app.agent_database import AgentAction, AgentSession, ZymoReporte, get_agents_engine
from app.agents.base import BaseAgent
from app.agents.tools import oc_tools
from app.config import settings

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """Eres ZYMO, el asistente ejecutivo de inteligencia artificial de Grupo ZYMO.

Grupo ZYMO es una empresa de logística colombiana conformada por: IMCCARGO, LOGIMAT e IMCDEPÓSITO.

## Tu rol
- Eres el orquestador principal — supervises toda la operación
- Tu usuario principal es el Gerente General y la Directora de Desarrollo (Andrea Reyes)
- También asistes a Andrés, el desarrollador de la intranet
- Reportas en lenguaje ejecutivo, no técnico

## Tono
- Directo, ejecutivo, concreto
- Español colombiano formal pero sin rigidez extrema
- Mencionas números y hechos — no vagas generalidades
- Si algo está bien, lo dices. Si algo está mal, lo dices sin rodeos

## Lo que PUEDES hacer
- Consultar el estado global de OC/Compras (solicitudes, cotizaciones, KPIs)
- Ver el listado de tareas técnicas de Andrés
- Generar reportes ejecutivos del estado de la operación
- Responder preguntas estratégicas sobre la plataforma
- Alertar sobre situaciones que requieran atención gerencial

## Lo que NO PUEDES hacer
- Aprobar, modificar o eliminar registros operativos
- Acceder a información financiera confidencial fuera de tu scope
- Enviar comunicaciones externas sin confirmación explícita

## Formato de reportes ejecutivos
- Primero: lo urgente
- Segundo: tendencias y métricas clave
- Tercero: recomendaciones concretas (máximo 3)
- Sin tecnicismos — lenguaje de negocio siempre

Cuando generes un reporte de ronda (cada 2 horas), sé conciso: máximo 200 palabras.
Cuando el gerente pregunte algo específico, profundiza cuanto necesite.
"""


class ZymoCore(BaseAgent):
    nombre: str = "zymo_core"
    modelo: str = "gemini-2.0-flash"

    def __init__(self, api_key: str) -> None:
        super().__init__(api_key)
        self._model = genai.GenerativeModel(
            self.modelo,
            system_instruction=_SYSTEM_PROMPT,
        )

    # ── Supervisión cada 2 horas ───────────────────────────────────────────────

    async def ronda_supervisora(self) -> str:
        """
        Pregunta al estado OC y genera un reporte de ronda.
        Se llama cada 2 horas desde el worker.
        """
        try:
            kpis = oc_tools.ver_kpis_oc()
            cotizaciones = oc_tools.consultar_cotizaciones_pendientes()
            tiempos = oc_tools.ver_tiempos_proceso_oc(limite_solicitudes=50)

            actividad_admin = self.resumen_actividad_administrativa()

            contexto = (
                f"[RONDA DE SUPERVISIÓN — {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC]\n\n"
                f"KPIs OC:\n{json.dumps(kpis, ensure_ascii=False, default=str)}\n\n"
                f"Cotizaciones pendientes aprobación: {len(cotizaciones)}\n"
                f"Con más de 48h esperando: {sum(1 for c in cotizaciones if c.get('supera_limite_48h'))}\n\n"
                f"Alertas de tiempo: {', '.join(tiempos.get('alertas_tiempo', [])) or 'ninguna'}\n\n"
                f"Actividad del Agente Administrativo (Sonia):\n{actividad_admin}\n"
            )

            reporte = await self.chat(
                f"Genera el reporte ejecutivo de esta ronda. Sé conciso, máximo 200 palabras:\n\n{contexto}"
            )

            self._guardar_reporte_db(
                tipo="ronda_2h",
                contenido=reporte,
                destinatario="gerente",
            )
            self._guardar_reporte_md(tipo="ronda_2h", contenido=reporte)
            self.registrar_accion("reporte", "ronda_supervisora", reporte)
            return reporte

        except Exception as e:
            logger.error("Error en ronda_supervisora: %s", e)
            return f"Error generando reporte de ronda: {e}"

    # ── Reporte diario ──────────────────────────────────────────────────────────

    async def reporte_diario(self) -> str:
        """Reporte ejecutivo del día. Se llama a las 8:00am desde el worker."""
        try:
            kpis = oc_tools.ver_kpis_oc()
            tiempos = oc_tools.ver_tiempos_proceso_oc(limite_solicitudes=100)
            cotizaciones = oc_tools.consultar_cotizaciones_pendientes()

            contexto = (
                f"[REPORTE DIARIO — {datetime.utcnow().strftime('%Y-%m-%d')}]\n\n"
                f"KPIs del día:\n{json.dumps(kpis, ensure_ascii=False, default=str)}\n\n"
                f"Tiempos de proceso:\n{json.dumps(tiempos, ensure_ascii=False, default=str)}\n\n"
                f"Cotizaciones pendientes: {len(cotizaciones)}\n"
            )

            reporte = await self.chat(
                f"Genera el reporte ejecutivo diario. Incluye: estado general, "
                f"puntos de atención y máximo 3 recomendaciones:\n\n{contexto}"
            )

            self._guardar_reporte_db(tipo="diario", contenido=reporte, destinatario="gerente")
            self._guardar_reporte_md(tipo="reporte_diario", contenido=reporte)
            self.registrar_accion("reporte", "reporte_diario", reporte)
            return reporte

        except Exception as e:
            logger.error("Error en reporte_diario: %s", e)
            return f"Error generando reporte diario: {e}"

    # ── Reporte semanal ─────────────────────────────────────────────────────────

    async def reporte_semanal(self) -> str:
        """Reporte semanal de tendencias. Lunes 7:00am."""
        try:
            tiempos = oc_tools.ver_tiempos_proceso_oc(limite_solicitudes=200)
            kpis = oc_tools.ver_kpis_oc()

            contexto = (
                f"[REPORTE SEMANAL — semana del {datetime.utcnow().strftime('%Y-%m-%d')}]\n\n"
                f"KPIs semana:\n{json.dumps(kpis, ensure_ascii=False, default=str)}\n\n"
                f"Tiempos de proceso (últimas 200 solicitudes):\n{json.dumps(tiempos, ensure_ascii=False, default=str)}\n"
            )

            reporte = await self.chat(
                f"Genera el reporte ejecutivo semanal. Incluye tendencias, "
                f"comparativa y prioridades para esta semana:\n\n{contexto}"
            )

            self._guardar_reporte_db(tipo="semanal", contenido=reporte, destinatario="gerente")
            self._guardar_reporte_md(tipo="reporte_semanal", contenido=reporte)
            self.registrar_accion("reporte", "reporte_semanal", reporte)
            return reporte

        except Exception as e:
            logger.error("Error en reporte_semanal: %s", e)
            return f"Error generando reporte semanal: {e}"

    # ── Verificar alertas críticas ──────────────────────────────────────────────

    async def verificar_alertas(self) -> list[str]:
        """
        Verifica si hay alertas críticas y guarda en DB si las hay.
        Se llama cada 15 minutos desde el worker.
        """
        try:
            kpis = oc_tools.ver_kpis_oc()
            alertas = kpis.get("alertas", [])
            cotizaciones = oc_tools.consultar_cotizaciones_pendientes()
            criticas = [c for c in cotizaciones if c.get("supera_limite_48h")]

            alertas_criticas = list(alertas)
            if criticas:
                alertas_criticas.append(
                    f"{len(criticas)} cotización(es) llevan más de 48h sin aprobación"
                )

            if alertas_criticas:
                contenido = json.dumps({"alertas": alertas_criticas}, ensure_ascii=False)
                self._guardar_reporte_db(tipo="alerta", contenido=contenido, destinatario="gerente")
                logger.warning("Alertas críticas detectadas: %s", alertas_criticas)

            return alertas_criticas

        except Exception as e:
            logger.error("Error en verificar_alertas: %s", e)
            return []

    # ── Chat con el gerente ─────────────────────────────────────────────────────

    async def chat_stream(
        self,
        mensaje: str,
        historial: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream enriquecido con contexto OC actualizado."""
        palabras_estrategicas = {
            "compra", "oc", "solicitud", "cotización", "cotizacion",
            "estado", "kpi", "tiempo", "pendiente", "reporte", "resumen",
        }
        necesita_oc = any(p in mensaje.lower() for p in palabras_estrategicas)

        contexto = ""
        if necesita_oc:
            try:
                kpis = oc_tools.ver_kpis_oc()
                contexto = (
                    f"\n[DATOS OC ACTUALES]\n"
                    f"Solicitudes activas: {kpis.get('total_activas', 0)}\n"
                    f"Por estado: {kpis.get('solicitudes_por_estado', {})}\n"
                    f"Alertas: {', '.join(kpis.get('alertas', [])) or 'ninguna'}\n\n"
                )
            except Exception as e:
                logger.warning("No se pudo obtener KPIs para chat gerente: %s", e)

        prompt = f"{contexto}Pregunta: {mensaje}" if contexto else mensaje

        async for chunk in super().chat_stream(prompt, historial=historial):
            yield chunk

    # ── Monitoreo del Agente Administrativo ────────────────────────────────────

    def leer_acciones_administrativo(self, limite: int = 20) -> list[dict]:
        """
        Lee las acciones recientes del Agente Administrativo.
        ZYMO usa esto para reportarle al gerente qué está haciendo Sonia y su agente.
        """
        from sqlmodel import Session, desc, select
        with Session(get_agents_engine()) as db:
            acciones = db.exec(
                select(AgentAction)
                .join(AgentSession, AgentAction.session_id == AgentSession.id)
                .where(AgentSession.agente == "administrativo")
                .order_by(desc(AgentAction.timestamp))
                .limit(limite)
            ).all()
            return [
                {
                    "tipo": a.tipo,
                    "input": a.input[:200] if a.input else "",
                    "output": a.output[:300] if a.output else "",
                    "timestamp": a.timestamp.isoformat(),
                    "tokens": a.tokens,
                }
                for a in acciones
            ]

    def resumen_actividad_administrativa(self) -> str:
        """
        Genera un resumen legible de la actividad reciente del Agente Administrativo.
        Incluido automáticamente en las rondas supervisoras.
        """
        try:
            acciones = self.leer_acciones_administrativo(limite=10)
            if not acciones:
                return "Sin actividad reciente del Agente Administrativo."

            lineas = [f"Últimas {len(acciones)} acciones del Agente Administrativo:"]
            for a in acciones:
                ts = a["timestamp"][:16].replace("T", " ")
                lineas.append(f"  [{ts}] {a['tipo']}: {a['input'][:80]}...")
            return "\n".join(lineas)
        except Exception as e:
            logger.error("Error leyendo actividad administrativa: %s", e)
            return "No se pudo obtener la actividad del Agente Administrativo."

    # ── Estado global de la plataforma ─────────────────────────────────────────

    def obtener_estado_intranet(self) -> dict[str, Any]:
        """Snapshot completo del estado de la plataforma."""
        try:
            kpis = oc_tools.ver_kpis_oc()
            cotizaciones = oc_tools.consultar_cotizaciones_pendientes()
            tiempos = oc_tools.ver_tiempos_proceso_oc(limite_solicitudes=50)

            return {
                "timestamp": datetime.utcnow().isoformat(),
                "oc": {
                    "total_activas": kpis.get("total_activas", 0),
                    "por_estado": kpis.get("solicitudes_por_estado", {}),
                    "cotizaciones_pendientes_aprobacion": len(cotizaciones),
                    "cotizaciones_mas_48h": sum(
                        1 for c in cotizaciones if c.get("supera_limite_48h")
                    ),
                    "alertas": kpis.get("alertas", []),
                },
                "tiempos": {
                    "promedio_por_etapa": tiempos.get("tiempos_por_etapa", {}),
                    "alertas_tiempo": tiempos.get("alertas_tiempo", []),
                },
                "estado": "ok" if not kpis.get("alertas") else "alertas_activas",
            }
        except Exception as e:
            logger.error("Error obteniendo estado intranet: %s", e)
            return {"estado": "error", "mensaje": str(e)}

    # ── Persistencia de reportes ────────────────────────────────────────────────

    def _guardar_reporte_db(self, tipo: str, contenido: str, destinatario: str) -> None:
        from sqlmodel import Session
        reporte = ZymoReporte(
            tipo=tipo,
            contenido=contenido,
            destinatario=destinatario,
        )
        with Session(get_agents_engine()) as db:
            db.add(reporte)
            db.commit()

    def _guardar_reporte_md(self, tipo: str, contenido: str) -> None:
        reports_dir = Path(settings.agent_logs_dir) / "reportes"
        reports_dir.mkdir(parents=True, exist_ok=True)
        fecha = datetime.utcnow().strftime("%Y-%m-%d_%H%M")
        ruta = reports_dir / f"{fecha}_{tipo}.md"
        encabezado = (
            f"# Reporte ZYMO Core — {tipo}\n"
            f"**Generado:** {datetime.utcnow().isoformat()}\n\n"
            "---\n\n"
        )
        ruta.write_text(encabezado + contenido, encoding="utf-8")
