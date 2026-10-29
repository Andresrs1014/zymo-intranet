# backend/app/services/extraction_pipeline.py
"""
Extracción de campos de una cotización, síncrona y sin servicios externos:
regex (cotizacion_parse) + extracción estructurada (extraction_utils) + tabla de ítems (motor de encabezados).
"""


def run_phase1(
    contenido: bytes,
    ext: str,
    solicitud_id: str,
) -> dict:
    """Extrae los campos de la cotización.

    Retorna dict compatible con ExtraccionResult de cotizaciones.py.
    """
    from app.services.cotizacion_parse import parsear_campos_cotizacion
    from app.services.extraction_utils import extraer_campos_estructurado
    from app.routers.oc.cotizaciones import _extraer_texto, _extraer_tabla_items

    extra: dict[str, str] = {}
    if ext in ("xlsx", "xls", "docx"):
        extra = extraer_campos_estructurado(contenido, ext)

    texto = _extraer_texto(contenido, ext)
    datos = parsear_campos_cotizacion(texto, extra)
    items_tabla = _extraer_tabla_items(contenido, ext)

    # Calcular cuántos campos se encontraron
    campos_encontrados = sum(1 for v in datos.values() if v is not None)
    if items_tabla:
        campos_encontrados += len(items_tabla)

    return {
        **datos,
        "items": items_tabla,
        "campos_encontrados": campos_encontrados,
    }
