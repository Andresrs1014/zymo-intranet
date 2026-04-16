"""
Diccionario de sinónimos y variantes para los campos de cotizaciones.

Cada clave es el nombre canónico del campo (igual al nombre en CotizacionProveedor/SolicitudOC).
El valor es una lista de variantes como las pueden escribir los proveedores en sus documentos.

Uso principal: motor de reconocimiento (extracción de PDFs/imágenes de cotizaciones).
Normaliza cualquier variante a su campo canónico antes de guardar en BD.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Tabla principal de sinónimos
# ---------------------------------------------------------------------------

FIELD_SYNONYMS: dict[str, list[str]] = {
    # ── Identificación del proveedor ────────────────────────────────────────
    "proveedor_nombre": [
        "proveedor",
        "nombre proveedor",
        "nombre del proveedor",
        "empresa",
        "nombre empresa",
        "nombre de la empresa",
        "razón social",
        "razon social",
        "razón social proveedor",
        "nombre",
        "vendedor",
        "suministrado por",
        "ofertante",
        "suministrador",
        "elaborado por",
        "cotizante",
        "supplier",
        "proveedor comercial",
        "entidad",
        "compañía",
        "compania",
    ],
    "proveedor_nit": [
        "nit",
        "nit proveedor",
        "n.i.t.",
        "n.i.t",
        "identificación",
        "identificacion",
        "nit/cc",
        "cc",
        "rut",
        "ruc",
        "cédula",
        "cedula",
        "número de identificación",
        "numero de identificacion",
        "n° identificación",
        "n° nit",
        "id tributario",
        "tax id",
        "número nit",
        "numero nit",
        "nit empresa",
        "nit razón social",
        "nit del proveedor",
        "identificación tributaria",
    ],
    "proveedor_email": [
        "email",
        "correo",
        "correo electrónico",
        "correo electronico",
        "e-mail",
        "mail",
        "dirección de correo",
        "email proveedor",
        "contacto email",
    ],

    # ── Número de cotización ────────────────────────────────────────────────
    "numero_cotizacion_proveedor": [
        "número de cotización",
        "numero de cotizacion",
        "n° cotización",
        "no. cotización",
        "cotización no.",
        "cot. no.",
        "cot no",
        "cotización",
        "cotizacion",
        "código cotización",
        "ref. cotización",
        "referencia cotización",
        "numero oferta",
        "n° oferta",
        "oferta no.",
        "propuesta no.",
        "propuesta",
        "número oferta",
        "código de oferta",
        "referencia oferta",
        "folio",
        "consecutivo cotización",
        "id cotización",
    ],

    # ── Descripción del producto/servicio ───────────────────────────────────
    "descripcion": [
        "descripción",
        "descripcion",
        "descripcion del producto",
        "descripción del producto",
        "artículo",
        "articulo",
        "ítem",
        "item",
        "producto",
        "servicio",
        "concepto",
        "detalle",
        "nombre del producto",
        "especificación",
        "especificacion",
        "denominación",
        "denominacion",
        "nombre artículo",
        "nombre item",
    ],

    # ── Referencia / código ─────────────────────────────────────────────────
    "referencia": [
        "referencia",
        "ref",
        "ref.",
        "código",
        "codigo",
        "cod",
        "cod.",
        "código producto",
        "modelo",
        "part number",
        "p/n",
        "sku",
        "número de parte",
        "no. parte",
        "referencia proveedor",
        "código proveedor",
        "ref proveedor",
        "código interno",
        "item code",
        "product code",
        "número de modelo",
        "num modelo",
    ],

    # ── Cantidad ────────────────────────────────────────────────────────────
    "cantidad": [
        "cantidad",
        "cant",
        "cant.",
        "qty",
        "unidades",
        "und",
        "uds",
        "número de unidades",
        "no. unidades",
        "unds",
        "cantidades",
        "total unidades",
        "piezas",
        "pzas",
        "unidad",
    ],

    # ── Valores económicos ───────────────────────────────────────────────────
    "valor_unitario": [
        "valor unitario",
        "precio unitario",
        "precio",
        "precio unit",
        "valor unit",
        "valor por unidad",
        "costo unitario",
        "precio x und",
        "precio x unidad",
        "vr unitario",
        "v/r unitario",
        "vlr unitario",
        "unit price",
        "precio neto",
        "valor neto unitario",
        "precio sin iva",
        "precio base",
        "costo por unidad",
        "vr unit",
    ],
    "valor_antes_iva": [
        "subtotal",
        "sub total",
        "sub-total",
        "valor antes de iva",
        "valor sin iva",
        "base gravable",
        "base iva",
        "base imponible",
        "imponible",
        "neto",
        "valor neto",
        "vr antes iva",
        "subtotal sin iva",
        "valor base",
        "subtotal antes de iva",
        "monto antes de iva",
        "precio neto total",
        "suma sin iva",
    ],
    "valor_iva": [
        "iva",
        "i.v.a.",
        "i.v.a",
        "iva 19%",
        "iva (19%)",
        "19%",
        "impuesto",
        "impuesto iva",
        "impuesto a las ventas",
        "tax",
        "vat",
        "valor iva",
        "monto iva",
        "iva total",
        "iva calculado",
        "impuesto al valor agregado",
        "valor del impuesto",
    ],
    "valor_total": [
        "valor total",
        "total",
        "total a pagar",
        "total factura",
        "precio total",
        "importe total",
        "total general",
        "total con iva",
        "gran total",
        "vlr total",
        "vr total",
        "monto total",
        "total pedido",
        "valor con iva",
        "precio final",
        "total a cancelar",
        "total invoice",
        "valor bruto",
        "total bruto",
        "suma total",
    ],

    # ── Condiciones comerciales ──────────────────────────────────────────────
    "forma_pago": [
        "forma de pago",
        "forma pago",
        "condiciones de pago",
        "condicion de pago",
        "condición de pago",
        "condiciones pago",
        "condiciones comerciales",
        "método de pago",
        "metodo de pago",
        "pago",
        "payment terms",
        "crédito",
        "credito",
        "plazo pago",
        "días de crédito",
        "dias de credito",
        "términos de pago",
        "terminos de pago",
        "modalidad de pago",
        "condición de venta",
        "condicion de venta",
        "política de pago",
    ],
    "plazo_entrega": [
        "plazo de entrega",
        "plazo entrega",
        "tiempo de entrega",
        "tiempo entrega",
        "fecha de entrega",
        "fecha entrega",
        "fecha aprox",
        "fecha aproximada",
        "fecha estimada de entrega",
        "fecha estimada",
        "plazo máximo",
        "plazo maximo",
        "lead time",
        "tiempo estimado",
        "días de entrega",
        "dias de entrega",
        "plazo de despacho",
        "tiempo de despacho",
        "días hábiles",
        "dias habiles",
        "tiempo de suministro",
        "tiempo suministro",
        "disponibilidad",
        "entrega estimada",
        "tiempo de respuesta",
        "días para entrega",
        "entrega inmediata",
        "inmediata",
        "tiempo de fabricación",
        "delivery time",
    ],
    "garantia": [
        "garantía",
        "garantia",
        "garantías",
        "garantias",
        "tiempo de garantía",
        "tiempo garantia",
        "período de garantía",
        "periodo garantia",
        "período garantía",
        "periodo garantía",
        "warranty",
        "vigencia garantía",
        "vigencia garantia",
        "cobertura garantía",
        "cobertura garantia",
        "garantía del producto",
        "garantia del producto",
        "meses de garantía",
        "meses garantia",
        "años de garantía",
        "garantia de calidad",
        "calidad garantía",
    ],
    "anticipo": [
        "anticipo",
        "anticipo requerido",
        "pago anticipado",
        "down payment",
        "abono inicial",
        "pago inicial",
        "porcentaje anticipo",
        "% anticipo",
        "adelanto",
        "advance payment",
        "pago por adelantado",
        "depósito",
        "deposito",
        "abono",
    ],
    "pago_saldo": [
        "pago saldo",
        "pago del saldo",
        "saldo",
        "saldo restante",
        "saldo a pagar",
        "balance",
        "balance payment",
        "pago contra entrega",
        "pago restante",
        "contra entrega",
        "pago al recibir",
        "pago final",
        "saldo pendiente",
    ],

    # ── Vigencia de la cotización ────────────────────────────────────────────
    "fecha_vigencia": [
        "fecha de cotización",
        "fecha cotización",
        "fecha",
        "vigencia",
        "válida hasta",
        "valida hasta",
        "fecha vigencia",
        "fecha validez",
        "válido hasta",
        "valido hasta",
        "fecha de oferta",
        "oferta válida hasta",
        "oferta valida hasta",
        "vence",
        "vencimiento",
        "expira",
        "expiración",
        "expiracion",
        "validity",
        "valid until",
        "expiry date",
    ],

    # ── Observaciones / notas ────────────────────────────────────────────────
    "observaciones": [
        "observaciones",
        "observación",
        "observacion",
        "notas",
        "nota",
        "comentarios",
        "comentario",
        "aclaraciones",
        "aclaración",
        "aclaracion",
        "condiciones especiales",
        "términos adicionales",
        "terminos adicionales",
        "observaciones adicionales",
        "remarks",
        "notes",
        "información adicional",
        "informacion adicional",
        "datos adicionales",
        "consideraciones",
        "especificaciones adicionales",
        "detalles adicionales",
    ],
}

# ---------------------------------------------------------------------------
# Índice invertido: variante → nombre canónico
# Permite buscar un encabezado de cotización y obtener el campo canónico.
# ---------------------------------------------------------------------------

_VARIANT_INDEX: dict[str, str] = {}

for _canonical, _variants in FIELD_SYNONYMS.items():
    # El nombre canónico mismo también es válido
    _VARIANT_INDEX[_canonical.lower()] = _canonical
    for _v in _variants:
        _VARIANT_INDEX[_v.lower()] = _canonical


def resolve_field(raw_label: str) -> str | None:
    """Devuelve el nombre canónico del campo dado un encabezado crudo.

    La búsqueda es insensible a mayúsculas/minúsculas y elimina espacios extra.
    Retorna None si no se encuentra ninguna coincidencia exacta.
    Use fuzzy_resolve() para coincidencias aproximadas.
    """
    normalized = " ".join(raw_label.strip().lower().split())
    return _VARIANT_INDEX.get(normalized)


def fuzzy_resolve(raw_label: str, threshold: float = 0.75) -> tuple[str | None, float]:
    """Coincidencia aproximada cuando resolve_field() no encuentra exacta.

    Usa SequenceMatcher de difflib (sin dependencias externas).
    Retorna (nombre_canónico, score) o (None, 0.0) si nada supera el umbral.
    """
    from difflib import SequenceMatcher

    normalized = " ".join(raw_label.strip().lower().split())
    best_match: str | None = None
    best_score = 0.0

    for variant, canonical in _VARIANT_INDEX.items():
        score = SequenceMatcher(None, normalized, variant).ratio()
        if score > best_score:
            best_score = score
            best_match = canonical

    if best_score >= threshold:
        return best_match, best_score
    return None, best_score


def get_synonyms(canonical_field: str) -> list[str]:
    """Retorna todas las variantes conocidas para un campo canónico."""
    return FIELD_SYNONYMS.get(canonical_field, [])


def all_variants_for_field(canonical_field: str) -> list[str]:
    """Retorna el nombre canónico + todas sus variantes (para construir prompts de LLM)."""
    variants = FIELD_SYNONYMS.get(canonical_field, [])
    return [canonical_field] + variants
