"""
Utilidades de parseo de valores monetarios colombianos.

Punto de verdad único para convertir strings de dinero a float en todo el proyecto.
Usado por el motor de extracción de cotizaciones y facturas.
"""

import re
from typing import Optional


def parse_cop(raw: str) -> Optional[float]:
    """
    Convierte un string de valor monetario colombiano a float.

    Soporta los formatos más comunes en documentos de proveedores:

    | Input            | Output      | Formato                        |
    |------------------|-------------|--------------------------------|
    | "1.500.000,50"   | 1500000.50  | Colombiano (punto miles, coma) |
    | "1.500.000"      | 1500000.0   | Colombiano solo miles          |
    | "1,500,000.50"   | 1500000.50  | Anglosajón (coma miles, punto) |
    | "1500,50"        | 1500.50     | Coma decimal                   |
    | "1500.50"        | 1500.50     | Punto decimal                  |
    | "1.500"          | 1500.0      | Un punto → separador de miles  |
    | "150.50"         | 150.50      | Un punto → decimal legítimo    |
    | "$1.500.000"     | 1500000.0   | Con símbolo $                  |

    Retorna None si el string está vacío o no es parseable.
    Retorna None si el resultado es negativo (no aplica para valores de compra).
    """
    try:
        cleaned = raw.replace("$", "").replace(" ", "").strip()
        if not cleaned:
            return None

        # Colombiano con punto de miles y coma decimal: 1.200.000,00
        if re.search(r"\d{1,3}(\.\d{3})+,\d{1,2}$", cleaned):
            cleaned = cleaned.replace(".", "").replace(",", ".")

        # Anglosajón con coma de miles y punto decimal: 1,200,000.50
        elif "," in cleaned and "." in cleaned:
            cleaned = cleaned.replace(",", "")

        # Solo coma → coma decimal colombiana: 1500,50
        elif "," in cleaned:
            cleaned = cleaned.replace(".", "").replace(",", ".")

        # Un solo punto → distinguir separador de miles vs decimal
        elif cleaned.count(".") == 1:
            _, _, decimales = cleaned.partition(".")
            if len(decimales) == 3:
                # "1.500" → miles, sin parte decimal → 1500
                cleaned = cleaned.replace(".", "")
            # else: "1500.50" → decimal legítimo, no tocar

        else:
            # Múltiples puntos sin coma: 1.200.000 → todos son separadores de miles
            # Excepción DIAN UBL: "2.821.530.000" → el ".000" final son centavos cero → ignorar
            _partes = cleaned.split(".")
            if (
                len(_partes) == 4
                and all(len(p) == 3 for p in _partes[1:])
                and _partes[-1] == "000"
            ):
                cleaned = "".join(_partes[:-1])
            else:
                cleaned = cleaned.replace(".", "")

        result = float(cleaned)
        return result if result >= 0 else None

    except Exception:
        return None


def format_cop(value: float | int | None, with_symbol: bool = False) -> Optional[str]:
    """Formatea un número a estilo colombiano (miles con punto, sin decimales).

    Ej:
      49850      -> "49.850"
      1500000.4  -> "1.500.000"
      None       -> None
    """
    if value is None:
        return None
    try:
        n = float(value)
    except Exception:
        return None

    # Mostrar centavos solo cuando son distintos de cero.
    cents = round(n % 1, 2)
    if cents > 0:
        entero = int(n)
        s = f"{entero:,}".replace(",", ".") + f",{round(cents * 100):02d}"
    else:
        s = f"{round(n):,}".replace(",", ".")
    return f"${s}" if with_symbol else s
