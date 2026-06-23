"""Extracción de texto de manuales de funciones (T&C → SIG análisis IA)."""
from __future__ import annotations

import io
import logging
import os
import subprocess
import tempfile
from typing import Optional

log = logging.getLogger(__name__)

MAX_TEXT = 50_000
MIN_USEFUL = 50
MANUALES_DIR = "/app/data/tc_manuales"


def manual_disk_path(cargo_id: int, manual_url: str) -> Optional[str]:
    """Resuelve ruta en disco (tc_manuales) a partir de la URL pública (/tc-manuales/)."""
    if not manual_url:
        return None
    ext = manual_url.rsplit(".", 1)[-1].lower() if "." in manual_url else ""
    if ext:
        primary = os.path.join(MANUALES_DIR, f"{cargo_id}.{ext}")
        if os.path.isfile(primary):
            return primary
    legacy = os.path.join("/app/data", manual_url.lstrip("/").replace("/", os.sep))
    if os.path.isfile(legacy):
        return legacy
    return None


def extraer_texto_manual(content: bytes, ext: str) -> str:
    ext = ext.lower().lstrip(".")
    try:
        if ext == "pdf":
            import pdfplumber

            with pdfplumber.open(io.BytesIO(content)) as pdf:
                digital = "\n".join(p.extract_text() or "" for p in pdf.pages)
            from app.services.ocr_service import texto_con_ocr_fallback

            return texto_con_ocr_fallback(digital, content)[:MAX_TEXT]

        if ext == "docx":
            from docx import Document

            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())[:MAX_TEXT]

        if ext == "doc":
            return _extraer_doc_antiword(content)[:MAX_TEXT]

        if ext in ("xlsx", "xls"):
            import openpyxl

            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            lines: list[str] = []
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    line = "\t".join("" if c is None else str(c) for c in row)
                    if line.strip():
                        lines.append(line)
            return "\n".join(lines)[:MAX_TEXT]
    except Exception as exc:
        log.warning("[tc_manual] Error extrayendo .%s: %s", ext, exc)
    return ""


def _extraer_doc_antiword(content: bytes) -> str:
    try:
        with tempfile.NamedTemporaryFile(suffix=".doc", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            proc = subprocess.run(
                ["antiword", "-m", "UTF-8.txt", tmp_path],
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout
            log.warning("[tc_manual] antiword exit=%s stderr=%s", proc.returncode, proc.stderr[:200])
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except FileNotFoundError:
        log.warning("[tc_manual] antiword no instalado — .doc sin texto extraído")
    except Exception as exc:
        log.warning("[tc_manual] antiword falló: %s", exc)
    return ""


def extraer_desde_archivo(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower()
    with open(path, "rb") as f:
        return extraer_texto_manual(f.read(), ext)


def cargo_manual_flags(manual_url: str, manual_text: str) -> dict[str, bool | int]:
    texto = (manual_text or "").strip()
    return {
        "tiene_archivo": bool(manual_url),
        "tiene_manual": len(texto) >= MIN_USEFUL,
        "texto_chars": len(texto),
    }
