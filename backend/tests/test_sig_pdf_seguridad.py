import unittest

from jinja2 import Environment, FileSystemLoader

from app.routers import sig_pdf as m


class UrlFetcherTests(unittest.TestCase):
    def test_permite_logo_y_data(self):
        logo = next(m._PLATFORMS_DIR.glob("*/*.png"))
        m._url_permitida(logo.resolve().as_uri())
        m._url_permitida("data:image/png;base64,AAAA")

    def test_rechaza_lo_demas(self):
        for url in (
            "file:///etc/passwd",
            "file:///C:/Windows/win.ini",
            (m._PLATFORMS_DIR / ".." / "main.py").as_uri(),
            "file://evil/share/x",
            "http://169.254.169.254/",
            "https://example.com/x.png",
            "ftp://x/y",
        ):
            with self.assertRaises(ValueError, msg=url):
                m._url_permitida(url)


class PlantillaTests(unittest.TestCase):
    def test_autoescape_y_contenido_seguro(self):
        env = Environment(loader=FileSystemLoader(str(m._TEMPLATES_DIR)), autoescape=True)
        malo = '<link rel="attachment" href="file:///etc/passwd">'
        ctx = dict(
            empresa_nombre="LOGIMAT", empresa_nit="", empresa_ciudad="", logo_url="", codigo="PR-1",
            titulo=malo, descripcion=malo, area="Calidad", version="1", estado="Vigente", estado_lower="vigente",
            fecha_emision="", contenido_agente_html=m._md_to_html("# Título <script>x</script>\n**Acción** y ñandú"),
            contenido_original="", mostrar_original=False, elaboro_nombre="Á", elaboro_cargo="", elaboro_fecha="",
            reviso_nombre="", reviso_cargo="", reviso_fecha="", aprobo_nombre="Á", aprobo_cargo="", aprobo_fecha="",
            commit_id=1, version_doc="", fecha_generacion="",
        )
        html = env.get_template("template_sig.html").render(**ctx)
        self.assertNotIn(malo, html)
        self.assertIn("&lt;link", html)
        self.assertNotIn("<script>", html)
        self.assertIn("<h1>Título &lt;script&gt;x&lt;/script&gt;</h1>", html)
        self.assertIn("<strong>Acción</strong> y ñandú", html)

    def test_content_disposition_no_ascii(self):
        h = m._content_disposition('PR-Ñ"ÁÉ_v1.pdf')
        h.encode("latin-1")
        self.assertIn("filename*=UTF-8''PR-%C3%91%22%C3%81%C3%89_v1.pdf", h)
        self.assertNotIn('Ñ', h)


if __name__ == "__main__":
    unittest.main()
