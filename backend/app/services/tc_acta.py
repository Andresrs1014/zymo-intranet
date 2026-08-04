"""Genera el PDF del acta de asistencia de T&C (tipo #1 y #2) con el logo y
los colores propios de la empresa/plataforma donde se dictó la capacitación
— reutiliza los logos ya subidos para el formato de Compras (platforms/*)."""
import base64
import json
from pathlib import Path
from typing import Optional

from app.services.platform_empresa import SLUG_MAP

_PLATFORMS_DIR = Path(__file__).resolve().parent.parent / "platforms"

_DEFAULT_COLORS = {"acta_primary": "#14b8a6", "acta_secondary": "#0f172a"}


def _cargar_empresa(nombre_sede: Optional[str]) -> dict:
    slug = SLUG_MAP.get((nombre_sede or "").lower().strip(), "logimat")
    config_path = _PLATFORMS_DIR / slug / "config.json"
    data: dict = {"nombre": nombre_sede or "", "logo": "", **_DEFAULT_COLORS}
    if config_path.exists():
        data.update(json.loads(config_path.read_text(encoding="utf-8")))
    logo_b64 = None
    if data.get("logo"):
        logo_path = _PLATFORMS_DIR / slug / data["logo"]
        if logo_path.is_file():
            ext = logo_path.suffix.lstrip(".") or "png"
            logo_b64 = f"data:image/{ext};base64,{base64.b64encode(logo_path.read_bytes()).decode()}"
    return {**data, "logo_b64": logo_b64}


def render_acta_pdf(
    *,
    nombre_sede: Optional[str],
    titulo: str,
    fecha_str: str,
    hora_inicio: str,
    hora_fin: str,
    contexto_label: str,
    contexto_valor: str,
    descripcion: str,
    nombres: list[str],
    foto_b64: Optional[str],
) -> bytes:
    empresa = _cargar_empresa(nombre_sede)
    primary = empresa.get("acta_primary") or _DEFAULT_COLORS["acta_primary"]
    secondary = empresa.get("acta_secondary") or _DEFAULT_COLORS["acta_secondary"]

    if foto_b64:
        filas = "".join(f"<tr><td>{n}</td></tr>" for n in nombres)
        tabla_head = "<tr><th>Nombre</th></tr>"
        evidencia_html = f'<img src="{foto_b64}" class="evidencia" />'
    else:
        filas = "".join(f'<tr><td>{n}</td><td class="firma"></td></tr>' for n in nombres)
        tabla_head = "<tr><th>Nombre</th><th>Firma</th></tr>"
        evidencia_html = ""

    logo_html = f'<img src="{empresa["logo_b64"]}" />' if empresa.get("logo_b64") else ""
    descripcion_html = f'<p class="descripcion">{descripcion}</p>' if descripcion else ""
    empresa_nombre = empresa.get("nombre", "")

    html = f"""
    <html><head><meta charset="utf-8"><style>
      @page {{ margin: 30px 40px; }}
      body {{ font-family: 'DejaVu Sans', sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; }}
      .header {{ display: flex; justify-content: space-between; align-items: flex-end;
                 border-bottom: 4px solid {primary}; padding-bottom: 12px; margin-bottom: 4px; }}
      .header img {{ height: 52px; }}
      .empresa-nombre {{ font-size: 10px; font-weight: 700; color: {secondary};
                          text-transform: uppercase; letter-spacing: .06em; margin-top: 6px; }}
      .titulo-doc {{ text-align: right; }}
      .titulo-doc h1 {{ font-size: 18px; margin: 0; color: {secondary}; }}
      .titulo-doc p {{ margin: 2px 0 0; font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: .06em; }}
      .banda {{ height: 5px; background: linear-gradient(90deg, {primary}, {secondary}); border-radius: 3px; margin: 10px 0 18px; }}
      .meta-grid {{ display: flex; flex-wrap: wrap; gap: 10px 30px; background: #f6f6f7;
                    padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }}
      .meta-grid div {{ font-size: 11px; }}
      .meta-grid strong {{ display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #888; margin-bottom: 2px; }}
      .descripcion {{ font-size: 11px; color: #444; margin-bottom: 16px; }}
      table {{ width: 100%; border-collapse: collapse; }}
      th {{ background: {secondary}; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 8px; text-align: left; }}
      td {{ border-bottom: 1px solid #e4e4e4; padding: 8px; font-size: 11px; }}
      tr:nth-child(even) td {{ background: #fafafa; }}
      .firma {{ width: 35%; }}
      .evidencia {{ max-width: 100%; max-height: 280px; margin-bottom: 18px; border: 1px solid #ddd; border-radius: 6px; }}
      .footer {{ margin-top: 22px; padding-top: 8px; border-top: 1px solid #eee; font-size: 9px; color: #999;
                 display: flex; justify-content: space-between; }}
    </style></head>
    <body>
      <div class="header">
        <div>
          {logo_html}
          <div class="empresa-nombre">{empresa_nombre}</div>
        </div>
        <div class="titulo-doc">
          <h1>Acta de asistencia</h1>
          <p>{titulo}</p>
        </div>
      </div>
      <div class="banda"></div>
      <div class="meta-grid">
        <div><strong>Fecha</strong>{fecha_str}</div>
        <div><strong>Hora</strong>{hora_inicio} – {hora_fin}</div>
        <div><strong>{contexto_label}</strong>{contexto_valor}</div>
      </div>
      {descripcion_html}
      {evidencia_html}
      <table>
        <thead>{tabla_head}</thead>
        <tbody>{filas}</tbody>
      </table>
      <div class="footer">
        <span>{empresa_nombre}</span>
        <span>Generado por la intranet ZYMO</span>
      </div>
    </body></html>
    """
    # Import perezoso — ver documentos.py para el motivo (GTK/Pango no siempre disponible).
    from weasyprint import HTML

    return HTML(string=html, base_url=str(_PLATFORMS_DIR)).write_pdf()
