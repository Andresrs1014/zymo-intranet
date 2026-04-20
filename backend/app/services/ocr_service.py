"""
Servicio OCR de fallback para PDFs escaneados.
Usa pytesseract + pdf2image como alternativa cuando pdfplumber no extrae texto.
Solo se activa cuando el texto extraído es menor a MIN_CHARS caracteres.
"""
import logging
from typing import Optional

log = logging.getLogger(__name__)

MIN_CHARS = 50  # umbral: menos de esto = probablemente escaneado


def _ocr_disponible() -> bool:
    """Verifica si tesseract está instalado en el sistema."""
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def extraer_texto_ocr(contenido: bytes, idioma: str = "spa+eng") -> str:
    """
    Convierte el PDF a imágenes y aplica OCR.
    Retorna el texto extraído o cadena vacía si falla.
    idioma: 'spa+eng' para documentos colombianos (español + inglés)
    """
    try:
        from pdf2image import convert_from_bytes
        import pytesseract

        images = convert_from_bytes(contenido, dpi=200)
        partes: list[str] = []
        for img in images:
            texto = pytesseract.image_to_string(img, lang=idioma, config="--psm 6")
            partes.append(texto)
        resultado = "\n".join(partes).strip()
        log.info("[ocr] Extraídos %d caracteres de %d páginas", len(resultado), len(images))
        return resultado
    except Exception as e:
        log.warning("[ocr] Fallo OCR: %s", e)
        return ""


def texto_con_ocr_fallback(texto_digital: str, contenido: bytes) -> str:
    """
    Retorna el texto digital si tiene suficiente contenido.
    Si no, intenta OCR como fallback.
    """
    if len(texto_digital.strip()) >= MIN_CHARS:
        return texto_digital

    if not _ocr_disponible():
        log.info("[ocr] Tesseract no disponible — usando texto digital (posiblemente vacío)")
        return texto_digital

    log.info("[ocr] Texto digital insuficiente (%d chars) — activando OCR", len(texto_digital.strip()))
    return extraer_texto_ocr(contenido) or texto_digital
