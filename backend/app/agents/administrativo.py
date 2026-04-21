"""
Agente Administrativo ZYMO — Asistente de Sonia Gómez.

Usa API Key 2 (Gemini cuenta #2).
Tiene acceso a herramientas OC y documentos RAG.
"""
import logging

from app.agents.base import BaseAgent
from app.agents.tools import doc_tools, oc_tools

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """Eres el Asistente Administrativo de ZYMO, una empresa de logística colombiana.

Tu usuario principal es Sonia Gómez, Directora Administrativa. También asistes a los auxiliares de compras.

## Tu identidad
- Nombre: Asistente Administrativo ZYMO
- Tono: Profesional, directo y proactivo
- Idioma: Español colombiano (tuteo, sin jerga extrema)
- No inventas datos — si no tienes acceso a algo, lo dices claramente

## Áreas que conoces
- Módulo OC/Compras: solicitudes, cotizaciones, tiempos de proceso
- Documentos internos: procedimientos, instructivos, políticas
- SGC (Sistema de Gestión de Calidad) — solo consulta, no modificas

## Lo que PUEDES hacer
- Consultar solicitudes de compra por estado o rango de fechas
- Mostrar cotizaciones pendientes de aprobación
- Calcular tiempos de proceso por etapa
- Buscar en documentos internos indexados (RAG)
- Dar resumen ejecutivo del estado del área de compras
- Generar alertas cuando algo está tardando más de lo normal

## Lo que NO PUEDES hacer
- Aprobar o rechazar cotizaciones (eso es solo Sonia, manualmente)
- Eliminar registros de la base de datos
- Enviar emails sin confirmación explícita del usuario
- Acceder a datos de otras empresas del grupo que no sean compras/administrativo

## Formato de respuestas
- Usar listas con viñetas para datos estructurados
- Resaltar alertas con ⚠️
- Resaltar cosas positivas con ✅
- Ser conciso — no repetir información que el usuario ya sabe
- Si hay alertas críticas, mencionarlas al inicio de la respuesta

## Cuando te pregunten por datos OC
Consulta primero los datos reales antes de responder. No inventes números.
"""


class AgenteAdministrativo(BaseAgent):
    nombre: str = "administrativo"
    modelo: str = "gemini-2.0-flash"

    def __init__(self, api_key: str) -> None:
        super().__init__(api_key)
        # Inyectar el system prompt en el modelo
        import google.generativeai as genai
        self._model = genai.GenerativeModel(
            self.modelo,
            system_instruction=_SYSTEM_PROMPT,
        )

    # ── Tools que el agente puede invocar ────────────────────────────────────

    def _obtener_estado_area(self) -> str:
        """Resumen del área para la ventana de bienvenida."""
        try:
            kpis = oc_tools.ver_kpis_oc()
            cotizaciones = oc_tools.consultar_cotizaciones_pendientes()

            lineas = []
            total_activas = kpis.get("total_activas", 0)
            lineas.append(f"Solicitudes activas: {total_activas}")

            por_estado = kpis.get("solicitudes_por_estado", {})
            nuevas = por_estado.get("nueva", 0)
            if nuevas:
                lineas.append(f"⚠️ Sin asignar: {nuevas}")

            pend_aprobacion = por_estado.get("pendiente_aprobacion", 0)
            if pend_aprobacion:
                lineas.append(f"⚠️ Pendiente aprobación: {pend_aprobacion}")

            cot_pendientes = len(cotizaciones)
            if cot_pendientes:
                supera_48h = sum(1 for c in cotizaciones if c.get("supera_limite_48h"))
                lineas.append(f"Cotizaciones por aprobar: {cot_pendientes}")
                if supera_48h:
                    lineas.append(f"⚠️ {supera_48h} llevan más de 48h esperando")

            return "\n".join(lineas) if lineas else "Todo en orden."
        except Exception as e:
            logger.error("Error obteniendo estado área: %s", e)
            return "No se pudo obtener el estado del área."

    async def generar_bienvenida(self, user_nombre: str) -> str:
        """Genera el mensaje de bienvenida personalizado al login."""
        estado = self._obtener_estado_area()
        prompt = (
            f"El usuario {user_nombre} acaba de iniciar sesión. "
            f"Genera un saludo corto y profesional con este resumen del área:\n\n{estado}\n\n"
            "Máximo 3 líneas. Menciona los puntos más urgentes primero."
        )
        try:
            return await self.chat(prompt)
        except Exception as e:
            logger.error("Error generando bienvenida: %s", e)
            return f"Hola {user_nombre}. {estado}"

    async def responder_con_contexto(
        self,
        mensaje: str,
        historial: list[dict] | None = None,
    ) -> str:
        """
        Responde enriqueciendo el contexto con datos reales de OC antes de llamar a Gemini.
        """
        # Determinar si la pregunta requiere datos OC frescos
        palabras_oc = {"solicitud", "oc", "cotización", "cotizacion", "compra", "proveedor", "pendiente", "estado", "tiempo", "kpi"}
        necesita_oc = any(p in mensaje.lower() for p in palabras_oc)

        contexto_adicional = ""
        if necesita_oc:
            try:
                kpis = oc_tools.ver_kpis_oc()
                contexto_adicional = (
                    f"\n[DATOS ACTUALES OC]\n"
                    f"Solicitudes activas: {kpis.get('total_activas', 0)}\n"
                    f"Por estado: {kpis.get('solicitudes_por_estado', {})}\n"
                    f"Cotizaciones pendientes aprobación: {kpis.get('cotizaciones_pendientes_aprobacion', 0)}\n"
                    f"Alertas: {', '.join(kpis.get('alertas', [])) or 'ninguna'}\n"
                )
            except Exception as e:
                logger.warning("No se pudo obtener KPIs OC: %s", e)

        prompt_enriquecido = f"{contexto_adicional}\nPregunta del usuario: {mensaje}" if contexto_adicional else mensaje
        return await self.chat(prompt_enriquecido, historial=historial)
