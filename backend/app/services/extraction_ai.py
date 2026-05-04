# backend/app/services/extraction_ai.py
"""
Extracción de campos de documentos usando Gemini File API.

IMPORTANTE: Este servicio hace llamadas de red a la API de Google.
Llamarlo SIEMPRE desde BackgroundTasks de FastAPI, nunca en el path síncrono.

Semáforo global MAX_CONCURRENT=2 para no saturar rate limits de Gemini.
"""
import asyncio
import json
import logging
import tempfile
from pathlib import Path
from typing import Optional

import google.generativeai as genai
from pydantic import BaseModel

from app.config import settings

_log = logging.getLogger("zymo.extraction_ai")

# Semáforo: máximo 2 llamadas Gemini simultáneas
_semaphore = asyncio.Semaphore(2)

# Campos canónicos que Gemini debe intentar extraer
CAMPOS_COTIZACION = [
    "proveedor_nombre", "proveedor_nit", "numero_cotizacion_proveedor",
    "valor_unitario", "valor_antes_iva", "valor_iva", "valor_total",
    "forma_pago", "plazo_entrega", "garantia", "anticipo", "pago_saldo",
]

CAMPOS_FACTURA = [
    "numero_factura", "fecha_factura", "valor_factura",
    "nit_proveedor", "nombre_proveedor",
]


class CampoExtraido(BaseModel):
    valor: Optional[str] = None
    confianza: str = "baja"      # "alta" | "media" | "baja"
    etiqueta_raw: Optional[str] = None  # cómo aparecía en el documento


class AIExtractionResult(BaseModel):
    campos: dict[str, CampoExtraido] = {}
    # Etiquetas que Gemini vio en el documento pero no supo mapear
    candidatos_sin_mapear: list[dict] = []
    # True si Gemini respondió con JSON válido
    exito: bool = False
    error: Optional[str] = None


def _build_prompt(tipo_documento: str, synonyms_hint: dict[str, list[str]]) -> str:
    campos = CAMPOS_COTIZACION if tipo_documento == "cotizacion" else CAMPOS_FACTURA

    campos_desc = "\n".join(
        f'- "{c}": variantes conocidas → {synonyms_hint.get(c, [])[:5]}'
        for c in campos
    )

    return f"""Eres un extractor de datos de documentos comerciales colombianos.

Analiza el documento adjunto ({tipo_documento}) y extrae los siguientes campos:

{campos_desc}

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{{
  "campos": {{
    "nombre_del_campo": {{
      "valor": "valor extraído como string, null si no se encuentra",
      "confianza": "alta|media|baja",
      "etiqueta_raw": "texto exacto del encabezado en el documento"
    }}
  }},
  "candidatos_sin_mapear": [
    {{"label": "etiqueta vista en doc", "valor": "valor asociado", "fragmento": "línea de contexto"}}
  ]
}}

Reglas:
- confianza "alta": etiqueta explícita y valor numérico/texto claro
- confianza "media": inferido por contexto o etiqueta ambigua
- confianza "baja": deducción incierta
- candidatos_sin_mapear: etiquetas con valores que NO corresponden a ningún campo de la lista
- Valores monetarios: string con el número tal como aparece (ej: "1.250.000" o "1250000")
- NO inventes valores — si no está en el documento, usa null
"""


async def extraer_con_gemini(
    contenido_bytes: bytes,
    ext: str,
    tipo_documento: str = "cotizacion",
    contexto_id: Optional[str] = None,
) -> AIExtractionResult:
    """Llama a Gemini con el PDF/Excel y retorna campos extraídos con confianza.

    Args:
        contenido_bytes: Bytes del archivo original.
        ext: Extensión del archivo ("pdf", "xlsx", "docx").
        tipo_documento: "cotizacion" | "factura".
        contexto_id: ID de solicitud o factura (solo para logging).

    Returns:
        AIExtractionResult con campos y candidatos.
    """
    if not settings.gemini_api_key:
        return AIExtractionResult(exito=False, error="GEMINI_API_KEY no configurada.")

    from app.services.synonym_loader import get_all_synonyms_for_prompt
    synonyms_hint = get_all_synonyms_for_prompt()

    # MIME types soportados por Gemini File API
    mime_map = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    mime_type = mime_map.get(ext, "application/octet-stream")

    async with _semaphore:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(settings.gemini_model)

            # Gemini File API: subir en archivo temporal
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(contenido_bytes)
                tmp_path = tmp.name

            uploaded = genai.upload_file(tmp_path, mime_type=mime_type)
            Path(tmp_path).unlink(missing_ok=True)

            prompt = _build_prompt(tipo_documento, synonyms_hint)

            response = await model.generate_content_async(
                [uploaded, prompt],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,  # Determinístico — no queremos creatividad
                ),
            )

            # Limpiar el archivo de Gemini (buena práctica)
            try:
                genai.delete_file(uploaded.name)
            except Exception:
                pass

            raw = response.text.strip()
            data = json.loads(raw)

            campos_parsed: dict[str, CampoExtraido] = {}
            for campo, info in data.get("campos", {}).items():
                campos_parsed[campo] = CampoExtraido(
                    valor=info.get("valor"),
                    confianza=info.get("confianza", "baja"),
                    etiqueta_raw=info.get("etiqueta_raw"),
                )

            _log.info(
                "[extraction_ai] contexto=%s tipo=%s campos=%d candidatos=%d",
                contexto_id, tipo_documento,
                len(campos_parsed),
                len(data.get("candidatos_sin_mapear", [])),
            )

            return AIExtractionResult(
                campos=campos_parsed,
                candidatos_sin_mapear=data.get("candidatos_sin_mapear", []),
                exito=True,
            )

        except Exception as e:
            _log.error("[extraction_ai] Error contexto=%s: %s", contexto_id, e)
            return AIExtractionResult(exito=False, error=str(e))
