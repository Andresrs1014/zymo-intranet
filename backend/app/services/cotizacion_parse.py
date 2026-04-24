import re
from typing import Optional

from app.services.number_utils import parse_cop


def parsear_campos_cotizacion(
    texto: str,
    extra: Optional[dict[str, str]] = None,
) -> dict[str, Optional[object]]:
    """Extrae campos principales (totales y condiciones) de texto libre.

    Diseñado para ser importable sin dependencias de FastAPI/routers, para permitir
    validación rápida en scripts y pruebas.
    """
    _extra = extra or {}

    def _to_float(raw: str) -> Optional[float]:
        return parse_cop(raw or "")

    def find_money(patterns: list[str]) -> Optional[float]:
        flags = re.IGNORECASE | re.MULTILINE | re.DOTALL
        for pat in patterns:
            m = re.search(pat, texto, flags)
            if m:
                val = _to_float(m.group(1))
                if val and val > 0:
                    return val
        return None

    def find_text(patterns: list[str]) -> Optional[str]:
        for pat in patterns:
            m = re.search(pat, texto, re.IGNORECASE | re.MULTILINE)
            if m:
                found = m.group(1).strip()
                if found:
                    return found[:200]
        return None

    def money_or_extra(field: str, patterns: list[str]) -> Optional[float]:
        return find_money(patterns) or _to_float(_extra.get(field, ""))

    def text_or_extra(field: str, patterns: list[str]) -> Optional[str]:
        return find_text(patterns) or (_extra.get(field) or None)

    nit = find_text(
        [
            r"N\.?I\.?T\.?[:\s#]*(\d[\d.\-]+[-]\d)",
            r"NIT[:\s#]*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-]?\d)",
        ]
    ) or (_extra.get("proveedor_nit") or None)

    total = money_or_extra(
        "valor_total",
        [
            r"TOTAL\s+A\s+PAGAR[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"VALOR\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"GRAN\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"\bTOTAL\b[\s\S]{0,15}?\$?\s*([\d.,]+)",
        ],
    )

    _subtotal_regex = find_money(
        [
            r"SUBTOTAL[:\s]*\$?\s*([\d.,]+)",
            r"SUB\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
            r"VALOR\s+ANTES\s+DE\s+IVA[:\s]*\$?\s*([\d.,]+)",
            r"BASE\s+(?:IVA|GRAVABLE)[:\s]*\$?\s*([\d.,]+)",
        ]
    )
    _subtotal_extra = _to_float(_extra.get("valor_antes_iva", ""))
    subtotal = _subtotal_regex or (_subtotal_extra if _subtotal_extra != total else None)

    iva = money_or_extra(
        "valor_iva",
        [
            r"(?m)^(?!.*\bBASE\b)(?!.*\bGRAVABLE\b).*\bIVA\s*19%?\b\s*[:\-]\s*\$?\s*([\d.,]+)",
            r"(?m)^(?!.*\bBASE\b)(?!.*\bGRAVABLE\b).*\bIVA\s*\(?\s*\d+\s*%?\s*\)?\s*[:\-]\s*\$?\s*([\d.,]+)",
            r"(?m)^(?!.*\bBASE\b)(?!.*\bGRAVABLE\b).*(?:IMPUESTO(?:\s+AL)?\s+VALOR\s+AGREGADO|IMPU?ESTO\s+IVA)\b[\s:;\-]*\$?\s*([\d.,]+)",
            r"(?m)^(?!.*\bBASE\b)(?!.*\bGRAVABLE\b).*\bIVA\b\s*[:\-]\s*\$?\s*([\d.,]+)",
        ],
    )

    if subtotal is not None and total is not None and subtotal > 0 and total > subtotal:
        iva_calc = round(total - subtotal, 2)
        iva_rango_razonable = 0 < iva_calc <= subtotal * 0.30
        if iva is None:
            # Cuando el documento trae subtotal + total pero no etiqueta el IVA explícitamente,
            # derivarlo como (total - subtotal) si cae en un rango razonable.
            if iva_rango_razonable:
                iva = iva_calc
        else:
            # Si el IVA extraído coincide con la base (caso típico "BASE IVA"), corregirlo.
            parece_base_iva = abs(iva - subtotal) <= max(1.0, subtotal * 0.005)
            if parece_base_iva and iva_rango_razonable:
                iva = iva_calc

    unitario = money_or_extra(
        "valor_unitario",
        [
            r"VALOR\s+UNITARIO[:\s]*\$?\s*([\d.,]+)",
            r"V\.?\s*UNITARIO[:\s]*\$?\s*([\d.,]+)",
            r"PRECIO\s+UNITARIO[:\s]*\$?\s*([\d.,]+)",
            r"P\.?\s*UNITARIO[:\s]*\$?\s*([\d.,]+)",
        ],
    )

    forma_pago = text_or_extra(
        "forma_pago",
        [
            r"FORMA\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
            r"CONDICI[OÓ]N(?:ES)?\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
            r"MODALIDAD\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
        ],
    )

    plazo = text_or_extra(
        "plazo_entrega",
        [
            r"PLAZO\s+DE\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
            r"TIEMPO\s+DE\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
            r"FECHA\s+(?:DE\s+)?ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
        ],
    )

    garantia = text_or_extra(
        "garantia",
        [
            r"GARANT[IÍ]A[:\s]+(.{3,200}?)(?:\n|$)",
            r"WARRANTY[:\s]+(.{3,200}?)(?:\n|$)",
        ],
    )

    anticipo = text_or_extra(
        "anticipo",
        [
            r"ANTICIPO[:\s]+(.{3,100}?)(?:\n|$)",
            r"PAGO\s+ANTICIPADO[:\s]+(.{3,100}?)(?:\n|$)",
            r"ABONO\s+INICIAL[:\s]+(.{3,100}?)(?:\n|$)",
        ],
    )

    pago_saldo = text_or_extra(
        "pago_saldo",
        [
            r"PAGO\s+(?:DEL\s+)?SALDO[:\s]+(.{3,100}?)(?:\n|$)",
            r"SALDO\s+A\s+PAGAR[:\s]+(.{3,100}?)(?:\n|$)",
            r"CONTRA\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
        ],
    )

    return {
        "proveedor_nit": nit,
        "valor_unitario": unitario,
        "valor_antes_iva": subtotal,
        "valor_iva": iva,
        "valor_total": total,
        "forma_pago": forma_pago,
        "plazo_entrega": plazo,
        "garantia": garantia,
        "anticipo": anticipo,
        "pago_saldo": pago_saldo,
    }

