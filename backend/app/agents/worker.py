"""
ZYMO Worker — Proceso persistente con tareas programadas.

Uso: python -m app.agents.worker

Tareas:
  - ronda_supervisora:  cada 2 horas  → ZYMO Core revisa el estado OC
  - verificar_alertas:  cada 15 min   → detectar alertas críticas
  - reporte_diario:     08:00am       → reporte ejecutivo del día
  - reporte_semanal:    lunes 07:00am → reporte semanal de tendencias
"""
import asyncio
import logging
import os
import sys

# Asegurar que el módulo app sea encontrable cuando se ejecuta como standalone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("zymo.worker")


def _get_zymo_core():
    """Instancia ZymoCore con la API Key gerencial."""
    from app.agents.zymo_core import ZymoCore
    from app.config import settings
    api_key = settings.gemini_api_key
    if not api_key:
        logger.warning("GEMINI_API_KEY no configurada — worker en modo silencioso.")
        return None
    return ZymoCore(api_key=api_key)


# ── Jobs ────────────────────────────────────────────────────────────────────────

async def job_ronda_supervisora():
    """Cada 2 horas: ZYMO Core genera reporte ejecutivo del área."""
    logger.info("▶ Iniciando ronda supervisora...")
    zymo = _get_zymo_core()
    if not zymo:
        return
    try:
        reporte = await zymo.ronda_supervisora()
        logger.info("✓ Ronda supervisora completada (%d caracteres)", len(reporte))
    except Exception as e:
        logger.error("✗ Error en ronda supervisora: %s", e)


async def job_verificar_alertas():
    """Cada 15 minutos: detectar alertas críticas y guardarlas en DB."""
    logger.debug("▶ Verificando alertas OC...")
    zymo = _get_zymo_core()
    if not zymo:
        return
    try:
        alertas = await zymo.verificar_alertas()
        if alertas:
            logger.warning("⚠ Alertas detectadas: %s", alertas)
        else:
            logger.debug("✓ Sin alertas críticas.")
    except Exception as e:
        logger.error("✗ Error verificando alertas: %s", e)


async def job_reporte_diario():
    """08:00am: reporte ejecutivo del día."""
    logger.info("▶ Generando reporte diario...")
    zymo = _get_zymo_core()
    if not zymo:
        return
    try:
        reporte = await zymo.reporte_diario()
        logger.info("✓ Reporte diario generado (%d caracteres)", len(reporte))
    except Exception as e:
        logger.error("✗ Error en reporte diario: %s", e)


async def job_reporte_semanal():
    """Lunes 07:00am: reporte semanal de tendencias."""
    logger.info("▶ Generando reporte semanal...")
    zymo = _get_zymo_core()
    if not zymo:
        return
    try:
        reporte = await zymo.reporte_semanal()
        logger.info("✓ Reporte semanal generado (%d caracteres)", len(reporte))
    except Exception as e:
        logger.error("✗ Error en reporte semanal: %s", e)


# ── Event listener ──────────────────────────────────────────────────────────────

def on_job_event(event):
    if event.exception:
        logger.error("Job '%s' falló: %s", event.job_id, event.exception)
    else:
        logger.debug("Job '%s' ejecutado exitosamente.", event.job_id)


# ── Main ────────────────────────────────────────────────────────────────────────

async def main():
    logger.info("🤖 ZYMO Worker iniciando...")

    # Inicializar tablas de agentes si no existen
    try:
        from app.agent_database import create_agent_tables
        create_agent_tables()
        logger.info("✓ Tablas de agentes verificadas.")
    except Exception as e:
        logger.warning("No se pudieron crear tablas de agentes: %s", e)

    scheduler = AsyncIOScheduler(timezone="America/Bogota")

    # Registrar jobs
    scheduler.add_job(
        job_verificar_alertas,
        "interval",
        minutes=15,
        id="verificar_alertas",
        name="Verificar alertas OC",
        max_instances=1,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        job_ronda_supervisora,
        "interval",
        hours=2,
        id="ronda_supervisora",
        name="Ronda supervisora ZYMO",
        max_instances=1,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        job_reporte_diario,
        "cron",
        hour=8,
        minute=0,
        id="reporte_diario",
        name="Reporte diario",
        max_instances=1,
        misfire_grace_time=600,
    )
    scheduler.add_job(
        job_reporte_semanal,
        "cron",
        day_of_week="mon",
        hour=7,
        minute=0,
        id="reporte_semanal",
        name="Reporte semanal",
        max_instances=1,
        misfire_grace_time=600,
    )

    scheduler.add_listener(on_job_event, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
    scheduler.start()

    logger.info("✓ Scheduler iniciado. Jobs registrados:")
    for job in scheduler.get_jobs():
        logger.info("  • %s — próxima ejecución: %s", job.name, job.next_run_time)

    # Ejecutar verificación inicial al arrancar
    await job_verificar_alertas()

    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 ZYMO Worker detenido.")
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
