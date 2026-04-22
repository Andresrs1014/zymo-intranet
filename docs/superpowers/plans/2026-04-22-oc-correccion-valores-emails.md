# OC: Corrección de Valores, Emails, Logos y Botón Generar OC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir todos los bugs del módulo OC encontrados en la auditoría: valores confundidos en PDF (subtotal/IVA/total), branding hardcodeado en emails, implementar correos por plataforma, logos en correos, remover datos sensibles del código, y mejorar el UI/UX del botón Generar OC.

**Architecture:** Backend FastAPI + frontend React 19. Los correos usan `email_service.py` con branding que se leerá dinámicamente desde `platforms/{slug}/config.json` en vez de constantes hardcodeadas. Los valores del PDF se muestran de forma independiente sin fallbacks que enmascaren datos faltantes. El frontend elimina las opciones hardcodeadas y las lee desde el backend.

**Tech Stack:** FastAPI, SQLModel, Jinja2, WeasyPrint, React 19, TypeScript, Tailwind CSS, TanStack Query

---

## Mapa de archivos

### Modificar
| Archivo | Qué cambia |
|---------|-----------|
| `backend/app/routers/oc/documentos.py` | Fix subtotal/IVA/total — no usar `or` encadenado que enmascara None |
| `backend/app/templates/template_oc.html` | Mostrar subtotal solo si tiene valor; indicar "No aplica" para IVA si es None |
| `backend/app/services/email_service.py` | Branding por plataforma, eliminar NITs hardcodeados, fallback a CONEXIONES LOGÍSTICAS, logos base64, fix XLSX fallback |
| `backend/app/platforms/logimat/config.json` | Agregar campos de branding para emails: `empresa_color`, `empresa_dept`, `email_prefijo` |
| `backend/app/platforms/imccargo/config.json` | Ídem |
| `backend/app/platforms/imcdep/config.json` | Ídem |
| `backend/app/services/field_synonyms.py` | Fix "precio neto" — mover a `valor_antes_iva`, no a `valor_unitario` |
| `frontend/src/pages/oc/SolicitudDetallePage.tsx` | Botón Generar OC: reemplazar emoji con SVG, opciones de plataforma desde config; `alert()` → estado de error |

### No modificar
- `extraction_utils.py` — motor de extracción estructurada está correcto
- `cotizaciones.py` — el motor regex está bien, el problema es en la presentación del PDF
- Modelos de BD — ningún cambio de esquema
- Endpoints del router — URLs y contratos sin cambios

---

## Hallazgos de auditoría (contexto para implementadores)

### Bug 1 — CRÍTICO: Subtotal en PDF muestra valor incorrecto
**Ubicación:** `backend/app/routers/oc/documentos.py`, función `_generar_pdf`, línea:
```python
"subtotal": cotizacion.valor_antes_iva or cotizacion.valor_total or 0,
```
**Qué pasa:** Si el auxiliar no llena `valor_antes_iva` (o la extracción no lo encuentra), el PDF muestra en SUBTOTAL el mismo número que en TOTAL (el valor con IVA). La directora ve SUBTOTAL=$119,000 e IVA=$0 y TOTAL=$119,000 — todos iguales.

**Fix:** No sustituir. Mostrar `valor_antes_iva` solo si existe; si no existe, no mostrarlo o mostrarlo como `None` en el template.

### Bug 2 — CRÍTICO: Email a proveedor busca XLSX que ya no existe
**Ubicación:** `backend/app/services/email_service.py`, función `send_oc_a_proveedor`:
```python
xlsx = Path(f"/app/data/oc_docs/{numero_oc}.xlsx")
if xlsx.exists():
    archivo = xlsx
```
**Qué pasa:** Después de la migración a WeasyPrint, los XLSX ya no se generan. Si el PDF falla, no hay fallback y el correo al proveedor no lleva adjunto (pero tampoco da error — simplemente no adjunta nada, logeando un warning).

**Fix:** Eliminar el fallback a XLSX. Si no hay PDF, lanzar excepción o retornar temprano con log de error.

### Bug 3 — ALTO: NITs y datos sensibles hardcodeados en código
**Ubicación:** `backend/app/services/email_service.py`:
```python
_BRANDING_DEFAULTS: dict[str, str] = {
    "empresa_nit":    "830.103.877-6",   # ← NIT en código fuente
    "empresa_nombre": "LOGIMAT S.A.S.",
    "empresa_color":  "#C8102E",
    "email_prefijo":  "[Compras LOGIMAT]",
    ...
}
```
Los NITs son datos tributarios que no deben estar en el repositorio de código.

**Fix:** Leer estos datos de `platforms/{slug}/config.json` (que está en `.gitignore` implícitamente por ser configuración de plataforma) o de `OcConfig` en BD. El default/fallback es "CONEXIONES LOGÍSTICAS" sin NIT expuesto.

### Bug 4 — ALTO: Correos no tienen branding por plataforma
**Qué pasa:** Todos los correos (Flujo 1-4, OC al proveedor) siempre muestran el branding de LOGIMAT, aunque la solicitud sea de IMC Cargo o IMC Depósito.

**¿Se puede hacer por plataforma?** SÍ — `SolicitudOC.plataforma` tiene el nombre, y ya existe `_SLUG_MAP` + `platforms/{slug}/config.json` con los datos de cada empresa.

**Fix:** Leer branding desde `platforms/{slug}/config.json` usando el campo `solicitud.plataforma`. Fallback a "CONEXIONES LOGÍSTICAS" cuando no hay plataforma o no se reconoce el slug.

### Bug 5 — ALTO: Opciones de plataforma hardcodeadas en el frontend
**Ubicación:** `frontend/src/pages/oc/SolicitudDetallePage.tsx`:
```tsx
<option value="logimat">LOGIMAT S.A.S.</option>
<option value="imc cargo">IMC Cargo International S.A.S.</option>
<option value="imc depósito">IMC Depósito S.A.S.</option>
```
Si se agrega una plataforma, hay que editar el frontend. Además los `value` son strings en minúsculas que no coinciden con los valores que puede traer la solicitud desde SharePoint (ej: "Logimat", "IMC Cargo International S.A.S.").

**Fix:** Crear endpoint `GET /api/oc/plataformas` que lea los slugs disponibles desde el filesystem de platforms, y consumirlo en el frontend.

### Bug 6 — MEDIO: field_synonyms ambiguo con "precio neto"
**Ubicación:** `backend/app/services/field_synonyms.py`:
- `"precio neto"` → `valor_unitario` (line 194) 
- `"precio neto total"` → `valor_antes_iva` (line 217)

En muchos documentos de proveedores colombianos, "PRECIO NETO" significa el precio sin IVA de toda la cotización (equivalente a subtotal), no el precio por unidad. Al mapearlo a `valor_unitario`, el auxiliar ve un número incorrecto en el campo unitario.

**Fix:** Mover `"precio neto"` de `valor_unitario` a `valor_antes_iva`. El precio unitario se identifica por "PRECIO UNITARIO", "V. UNITARIO", "VALOR UNIT", etc. — términos más específicos que ya están en la lista.

### Bug 7 — MEDIO: Logos no aparecen en los correos HTML
**Qué pasa:** Los templates HTML de correo no incluyen imágenes. Los logos están en `platforms/{slug}/` como archivos locales, no accesibles por URL pública.

**Solución:** Incrustar los logos como base64 en el cuerpo del correo. Esto es el estándar de la industria para logos en emails transaccionales — no depende de que el servidor esté disponible externamente y funciona en todos los clientes de correo.

### Bug 8 — BAJO: `alert()` en JavaScript para errores
**Ubicación:** `SolicitudDetallePage.tsx:104`:
```tsx
onError: () => alert("Error al generar la OC..."),
```
`alert()` es un antipatrón: bloquea el hilo, es inaccesible para lectores de pantalla, y visualmente inconsistente con el resto de la UI.

**Fix:** Usar el mismo patrón de estado de error que usa `CotizacionFormPage.tsx` (estado `error` con mensaje debajo del botón).

### Bug 9 — UI/UX: Botón Generar OC usa emoji como ícono
**Ubicación:** `SolicitudDetallePage.tsx`:
```tsx
<span className="text-brand-blue text-lg">🖨️</span>
```
Emojis como íconos estructurales violan las reglas de UI/UX Pro Max (anti-patrón `no-emoji-icons`): son inconsistentes entre plataformas y no se pueden estilizar.

**Fix:** Reemplazar con SVG inline de un ícono de documento/OC coherente con el estilo de la UI existente.

---

## Task 1: Endpoint GET /api/oc/plataformas

**Files:**
- Modify: `backend/app/routers/oc/shared.py`
- Modify: `backend/app/routers/oc/router.py`

- [ ] **Step 1: Agregar el endpoint en shared.py**

  En `backend/app/routers/oc/shared.py`, agregar al final del archivo:

  ```python
  from pathlib import Path
  import json

  _PLATFORMS_DIR = Path(__file__).parent.parent.parent / "platforms"

  _SLUG_DISPLAY: dict[str, str] = {
      "logimat": "LOGIMAT S.A.S.",
      "imccargo": "IMC Cargo International S.A.S.",
      "imcdep": "IMC Depósito S.A.S.",
  }


  @router.get("/plataformas")
  def listar_plataformas():
      """Retorna las plataformas disponibles con su slug y nombre para mostrar."""
      plataformas = []
      for slug_dir in sorted(_PLATFORMS_DIR.iterdir()):
          if not slug_dir.is_dir():
              continue
          cfg_path = slug_dir / "config.json"
          nombre = _SLUG_DISPLAY.get(slug_dir.name, slug_dir.name.upper())
          if cfg_path.exists():
              try:
                  cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
                  nombre = cfg.get("nombre", nombre)
              except Exception:
                  pass
          plataformas.append({"slug": slug_dir.name, "nombre": nombre})
      return plataformas
  ```

  > Nota: Si `shared.py` ya tiene un router definido, usar ese. Si no, verificar qué router corresponde y adaptar el import.

- [ ] **Step 2: Verificar que el endpoint responde**

  Con el backend corriendo:
  ```bash
  curl http://localhost:8001/api/oc/plataformas
  ```

  Resultado esperado:
  ```json
  [
    {"slug": "imccargo", "nombre": "IMC Cargo International S.A.S."},
    {"slug": "imcdep", "nombre": "IMC Depósito S.A.S."},
    {"slug": "logimat", "nombre": "LOGIMAT S.A.S."}
  ]
  ```

---

## Task 2: Agregar campos de branding a los config.json de plataforma

**Files:**
- Modify: `backend/app/platforms/logimat/config.json`
- Modify: `backend/app/platforms/imccargo/config.json`
- Modify: `backend/app/platforms/imcdep/config.json`

- [ ] **Step 1: Actualizar logimat/config.json**

  Reemplazar el contenido con (conservar los campos existentes, agregar los nuevos):

  ```json
  {
    "nombre": "LOGIMAT S.A.S.",
    "nit": "830.103.877-6",
    "direccion_entrega": "Carrera 106 No. 15A-25 - Manzana 23 LTE 135M",
    "ciudad": "Zona Franca de Bogotá - Colombia",
    "pbx": "(1) 7 44 92 00",
    "email_facturacion": "830103877@factureinbox.co",
    "logo": "logo_logimat.png",
    "empresa_color": "#1D3557",
    "empresa_dept": "Departamento de Compras",
    "email_prefijo": "[Compras Conexiones Logísticas]",
    "texto_cumplimiento": "Nuestro grupo logístico LOGIMAT SAS, IMC CARGO INTERNATIONAL SAS e IMC DEPOSITO SAS orientados bajo estándares de transparencia, seguridad e integridad empresarial y con la finalidad de asegurar relaciones comerciales saludables, dentro del marco legal y en virtud de ello siendo conscientes que a nivel global estamos expuestos a riesgos tales como, el lavado de activos, financiamiento del terrorismo, extorsión, tráfico de armas, soborno, ciberataques, contaminación de la carga, entre otros. Lo invitamos a participar en la prevención de los riesgos, manteniendo su negocio con procesos de seguridad y conocimiento de sus asociados, lo cual fortalece nuestras relaciones comerciales y evita perdida de estas y permite crecimiento entre las partes interesadas."
  }
  ```

- [ ] **Step 2: Actualizar imccargo/config.json**

  ```json
  {
    "nombre": "IMC CARGO INTERNATIONAL S.A.S.",
    "nit": "830.513.769-8",
    "direccion_entrega": "KM 2.5 Siberia-Bogotá, Costado Sur, Centro Logístico Industrial CLIC 80",
    "ciudad": "Bogotá, Colombia",
    "pbx": "(1) 7 44 92 01",
    "email_facturacion": "830513769@factureinbox.co",
    "logo": "imccargo_logo.jpeg",
    "empresa_color": "#1D3557",
    "empresa_dept": "Departamento de Compras",
    "email_prefijo": "[Compras Conexiones Logísticas]",
    "texto_cumplimiento": "Nuestro grupo logístico LOGIMAT SAS, IMC CARGO INTERNATIONAL SAS e IMC DEPOSITO SAS orientados bajo estándares de transparencia, seguridad e integridad empresarial y con la finalidad de asegurar relaciones comerciales saludables, dentro del marco legal y en virtud de ello siendo conscientes que a nivel global estamos expuestos a riesgos tales como, el lavado de activos, financiamiento del terrorismo, extorsión, tráfico de armas, soborno, ciberataques, contaminación de la carga, entre otros. Lo invitamos a participar en la prevención de los riesgos, manteniendo su negocio con procesos de seguridad y conocimiento de sus asociados, lo cual fortalece nuestras relaciones comerciales y evita perdida de estas y permite crecimiento entre las partes interesadas."
  }
  ```

- [ ] **Step 3: Actualizar imcdep/config.json**

  ```json
  {
    "nombre": "IMC DEPOSITO S.A.S.",
    "nit": "900.907.185-2",
    "direccion_entrega": "KM 2.5 Autopista Bogotá-Medellín, Centro Logístico Industrial CLIC 80",
    "ciudad": "Bogotá, Colombia",
    "pbx": "(1) 7 44 92 01",
    "email_facturacion": "900907185@factureinbox.co",
    "logo": "imcdep_logo.jpeg",
    "empresa_color": "#1D3557",
    "empresa_dept": "Departamento de Compras",
    "email_prefijo": "[Compras Conexiones Logísticas]",
    "texto_cumplimiento": "Nuestro grupo logístico LOGIMAT SAS, IMC CARGO INTERNATIONAL SAS e IMC DEPOSITO SAS orientados bajo estándares de transparencia, seguridad e integridad empresarial y con la finalidad de asegurar relaciones comerciales saludables, dentro del marco legal y en virtud de ello siendo conscientes que a nivel global estamos expuestos a riesgos tales como, el lavado de activos, financiamiento del terrorismo, extorsión, tráfico de armas, soborno, ciberataques, contaminación de la carga, entre otros. Lo invitamos a participar en la prevención de los riesgos, manteniendo su negocio con procesos de seguridad y conocimiento de sus asociados, lo cual fortalece nuestras relaciones comerciales y evita perdida de estas y permite crecimiento entre las partes interesadas."
  }
  ```

---

## Task 3: Fix subtotal/IVA/total en el PDF generado

**Files:**
- Modify: `backend/app/routers/oc/documentos.py`
- Modify: `backend/app/templates/template_oc.html`

- [ ] **Step 1: Corregir el contexto en `_generar_pdf`**

  En `backend/app/routers/oc/documentos.py`, en la función `_generar_pdf`, reemplazar el bloque de totales en el `context`:

  ```python
  # ANTES (incorrecto — enmascara cuando valor_antes_iva es None):
  # "subtotal": cotizacion.valor_antes_iva or cotizacion.valor_total or 0,

  # DESPUÉS (correcto — cada campo es independiente):
  "subtotal": cotizacion.valor_antes_iva,   # None si no se proporcionó
  "iva": cotizacion.valor_iva,               # None si no aplica
  "total": cotizacion.valor_total or 0,
  ```

  El campo `total` sí debe tener valor siempre (es requerido en la BD con `float` sin Optional).

- [ ] **Step 2: Actualizar el template para manejar valores None**

  En `backend/app/templates/template_oc.html`, reemplazar la sección `<!-- NOTA + TOTALES -->` completa:

  ```html
  <!-- NOTA + TOTALES -->
  <div class="totals-wrap">
    <div class="totals-nota">
      <span class="fw-bold">Nota:</span><br>
      {{ nota or "—" }}<br><br>
      <span class="fw-bold">Buzón Facturación:</span> {{ empresa.email_facturacion }}
    </div>
    <div class="totals-nums">
      <table>
        {% if subtotal is not none %}
        <tr>
          <td class="tlabel">SUBTOTAL</td>
          <td class="tvalue">${{ "{:,.0f}".format(subtotal) }}</td>
        </tr>
        {% endif %}
        {% if iva is not none %}
        <tr>
          <td class="tlabel">IVA</td>
          <td class="tvalue">${{ "{:,.0f}".format(iva) }}</td>
        </tr>
        {% elif subtotal is not none %}
        <tr>
          <td class="tlabel" style="color:#94a3b8;">IVA</td>
          <td class="tvalue" style="color:#94a3b8;">No aplica / incluido</td>
        </tr>
        {% endif %}
        <tr class="total-row">
          <td>TOTAL</td>
          <td>${{ "{:,.0f}".format(total) }}</td>
        </tr>
      </table>
    </div>
  </div>
  ```

  > Nota: Jinja2 compara con `none` (minúsculas) en condiciones `is not none`.

- [ ] **Step 3: Verificar build TypeScript/Python no roto**

  ```bash
  cd backend && python -c "from app.routers.oc.documentos import _generar_pdf; print('OK')"
  ```

  Resultado esperado: `OK` sin errores de importación.

---

## Task 4: Fix field_synonyms — "precio neto" → valor_antes_iva

**Files:**
- Modify: `backend/app/services/field_synonyms.py`

- [ ] **Step 1: Mover "precio neto" de valor_unitario a valor_antes_iva**

  En `field_synonyms.py`, en la entrada `"valor_unitario"`, remover estas líneas:
  ```python
  "precio neto",
  "valor neto unitario",
  ```

  En la entrada `"valor_antes_iva"`, agregar estas mismas líneas:
  ```python
  "precio neto",
  "valor neto unitario",
  ```

  > Justificación: En Colombia, "PRECIO NETO" en el cuerpo de una cotización normalmente significa el precio antes de IVA del total del pedido, no el precio por unidad. El precio unitario se identifica explícitamente con "PRECIO UNITARIO", "V. UNITARIO", "VALOR UNIT" — términos más específicos que ya están correctamente mapeados.

- [ ] **Step 2: Invalidar el caché LRU de las funciones de resolución**

  Las funciones `resolve_field` y `fuzzy_resolve` tienen `@lru_cache`. Al modificar `FIELD_SYNONYMS`, el índice `_VARIANT_INDEX` se reconstruye al importar el módulo, pero el caché LRU no se invalida automáticamente si el módulo está en memoria.

  **Esto se resuelve automáticamente con el reinicio del servicio** (Docker restart). No requiere cambios en código — documentar en el PR.

- [ ] **Step 3: Verificar que el índice se construye correctamente**

  ```bash
  cd backend && python -c "
  from app.services.field_synonyms import resolve_field
  assert resolve_field('precio neto') == 'valor_antes_iva', f'Got: {resolve_field(\"precio neto\")}'
  assert resolve_field('precio unitario') == 'valor_unitario', f'Got: {resolve_field(\"precio unitario\")}'
  assert resolve_field('valor unitario') == 'valor_unitario', f'Got: {resolve_field(\"valor unitario\")}'
  print('OK — todos los campos resuelven correctamente')
  "
  ```

  Resultado esperado: `OK — todos los campos resuelven correctamente`

---

## Task 5: email_service.py — branding por plataforma + CONEXIONES LOGÍSTICAS + fix XLSX

**Files:**
- Modify: `backend/app/services/email_service.py`

Este task tiene 4 cambios relacionados que van juntos:
1. Reemplazar `_BRANDING_DEFAULTS` hardcodeado
2. Agregar función `_load_platform_branding` que lee `platforms/{slug}/config.json`
3. Actualizar `_get_runtime_config` para incorporar el branding por plataforma
4. Fix fallback XLSX en `send_oc_a_proveedor`

- [ ] **Step 1: Agregar `_SLUG_MAP` y `_load_platform_branding` debajo de los imports**

  En `email_service.py`, reemplazar el bloque `_BRANDING_DEFAULTS` y `_INTRO_DEFAULTS` completo con:

  ```python
  from pathlib import Path as _Path
  import json as _json

  _PLATFORMS_DIR = _Path(__file__).parent.parent / "platforms"

  _SLUG_MAP: dict[str, str] = {
      "logimat": "logimat",
      "logimat s.a.s.": "logimat",
      "imccargo": "imccargo",
      "imc cargo": "imccargo",
      "imc cargo international": "imccargo",
      "imc cargo international s.a.s.": "imccargo",
      "imcdep": "imcdep",
      "imc deposito": "imcdep",
      "imc depósito": "imcdep",
      "imc deposito s.a.s.": "imcdep",
      "imc depósito s.a.s.": "imcdep",
  }

  # Branding por defecto cuando no se reconoce la plataforma
  # NITs y datos específicos de empresas NO van aquí — van en config.json de plataforma
  _BRANDING_DEFAULTS: dict[str, str] = {
      "empresa_nombre": "Conexiones Logísticas",
      "empresa_color":  "#2563EB",
      "empresa_nit":    "",
      "empresa_tel":    "",
      "empresa_dir":    "Bogotá, Colombia",
      "empresa_dept":   "Departamento de Compras",
      "email_prefijo":  "[Compras Conexiones Logísticas]",
  }

  _INTRO_DEFAULTS: dict[str, str] = {
      "email_intro_flujo1": (
          "Tu solicitud de compra ha sido recibida y un auxiliar de compras ya está trabajando en ella. "
          "Te notificaremos en cuanto tengamos una cotización lista."
      ),
      "email_intro_flujo2": (
          "Ya tenemos una cotización lista para tu solicitud. Está en proceso de aprobación por la dirección. "
          "Te notificaremos cuando la orden de compra sea enviada al proveedor."
      ),
      "email_intro_flujo3": "Hay una solicitud de compra que requiere tu aprobación:",
      "email_intro_flujo4": (
          "La Orden de Compra para tu solicitud ha sido generada y enviada al proveedor."
      ),
  }


  def _load_platform_branding(plataforma: str | None) -> dict[str, str]:
      """Lee los campos de branding desde platforms/{slug}/config.json.

      Retorna dict vacío si no se reconoce la plataforma o no existe el archivo.
      El llamador hace merge con _BRANDING_DEFAULTS como fallback.
      """
      if not plataforma:
          return {}
      slug = _SLUG_MAP.get(plataforma.lower().strip())
      if not slug:
          return {}
      cfg_path = _PLATFORMS_DIR / slug / "config.json"
      if not cfg_path.exists():
          return {}
      try:
          cfg = _json.loads(cfg_path.read_text(encoding="utf-8"))
          return {
              "empresa_nombre": cfg.get("nombre", ""),
              "empresa_color":  cfg.get("empresa_color", ""),
              "empresa_nit":    cfg.get("nit", ""),
              "empresa_tel":    cfg.get("pbx", ""),
              "empresa_dir":    cfg.get("ciudad", cfg.get("direccion_entrega", "")),
              "empresa_dept":   cfg.get("empresa_dept", ""),
              "email_prefijo":  cfg.get("email_prefijo", ""),
          }
      except Exception as exc:
          log.warning("[email] No se pudo leer config de plataforma '%s': %s", slug, exc)
          return {}
  ```

- [ ] **Step 2: Actualizar `_get_runtime_config` para aceptar plataforma**

  Reemplazar la firma y la lógica de merge de branding en `_get_runtime_config`:

  ```python
  def _get_runtime_config(plataforma: str | None = None) -> dict:
      """Lee la config SMTP y branding de oc_config (DB), con fallback a settings/.env.

      Si se proporciona `plataforma`, aplica el branding específico de esa plataforma
      encima de los defaults. La DB sobreescribe todo (permite personalización por cliente).
      """
      from sqlmodel import Session, select
      from app.models.oc import OcConfig
      from app.oc_database import get_oc_engine

      # Base: defaults genéricos de Conexiones Logísticas
      cfg: dict = {
          "smtp_user":       settings.smtp_user,
          "smtp_password":   settings.smtp_password,
          "smtp_from":       settings.smtp_from or settings.smtp_user,
          "smtp_host":       settings.smtp_host,
          "smtp_port":       settings.smtp_port,
          "email_directora": settings.email_directora,
          "email_compras":   "",
          "intranet_url":    settings.intranet_url,
          **_BRANDING_DEFAULTS,
          "email_intro_flujo1": "",
          "email_intro_flujo2": "",
          "email_intro_flujo3": "",
          "email_intro_flujo4": "",
      }

      # Capa 1: branding de la plataforma (desde config.json)
      platform_branding = _load_platform_branding(plataforma)
      for k, v in platform_branding.items():
          if v:  # solo sobreescribir si el valor no está vacío
              cfg[k] = v

      # Capa 2: valores de la DB sobreescriben todo (permite personalización)
      try:
          with Session(get_oc_engine()) as db:
              for row in db.exec(select(OcConfig)).all():
                  if row.key in cfg and row.value:
                      cfg[row.key] = int(row.value) if row.key == "smtp_port" else row.value
      except Exception as exc:
          log.warning("[email] No se pudo leer oc_config de DB: %s", exc)

      return cfg
  ```

- [ ] **Step 3: Actualizar todas las funciones públicas para pasar plataforma**

  Cada función pública (`send_en_gestion`, `send_cotizacion_lista`, etc.) recibe una `SolicitudOC` que tiene `.plataforma`. Actualizar todas para pasar ese campo:

  ```python
  # Patrón que aplica a todas las funciones send_*:
  # ANTES:
  cfg = _get_runtime_config()
  # DESPUÉS:
  cfg = _get_runtime_config(plataforma=s.plataforma)
  ```

  Funciones que aplica: `send_en_gestion`, `send_cotizacion_lista`, `send_aprobacion_directora`, `send_oc_enviada`, `send_entrega_confirmada`, `send_rechazo_cotizacion`, `send_nueva_solicitud_interna`.

  Para `send_oc_a_proveedor`, la firma ya recibe `s: SolicitudOC`:
  ```python
  cfg = _get_runtime_config(plataforma=s.plataforma)
  ```

- [ ] **Step 4: Fix fallback XLSX en `send_oc_a_proveedor`**

  Reemplazar el bloque de búsqueda de archivo en `send_oc_a_proveedor`:

  ```python
  # ANTES (busca XLSX como fallback — ya no existe post-migración a WeasyPrint):
  # archivo: Path | None = None
  # if pdf_path:
  #     p = Path(pdf_path)
  #     if p.exists():
  #         archivo = p
  # if archivo is None:
  #     xlsx = Path(f"/app/data/oc_docs/{numero_oc}.xlsx")
  #     if xlsx.exists():
  #         archivo = xlsx

  # DESPUÉS (solo PDF):
  archivo: Path | None = None
  if pdf_path:
      p = Path(pdf_path)
      if p.exists():
          archivo = p

  if archivo is None:
      log.error(
          "[email] OC %s: PDF no encontrado en '%s' — correo al proveedor no enviado",
          numero_oc, pdf_path
      )
      return
  ```

- [ ] **Step 5: Verificar que el módulo importa sin errores**

  ```bash
  cd backend && python -c "from app.services.email_service import send_en_gestion; print('OK')"
  ```

  Resultado esperado: `OK`

---

## Task 6: Logos base64 en correos HTML

**Files:**
- Modify: `backend/app/services/email_service.py`

- [ ] **Step 1: Agregar función `_logo_base64`**

  En `email_service.py`, después de `_load_platform_branding`, agregar:

  ```python
  import base64 as _base64
  import mimetypes as _mimetypes


  def _logo_base64(plataforma: str | None) -> str:
      """Retorna el logo de la plataforma como data URI base64 para incrustar en HTML.

      Retorna string vacío si no se encuentra el logo o no se reconoce la plataforma.
      """
      if not plataforma:
          return ""
      slug = _SLUG_MAP.get(plataforma.lower().strip())
      if not slug:
          return ""
      cfg_path = _PLATFORMS_DIR / slug / "config.json"
      if not cfg_path.exists():
          return ""
      try:
          cfg = _json.loads(cfg_path.read_text(encoding="utf-8"))
          logo_filename = cfg.get("logo")
          if not logo_filename:
              return ""
          logo_path = _PLATFORMS_DIR / slug / logo_filename
          if not logo_path.exists():
              return ""
          mime, _ = _mimetypes.guess_type(str(logo_path))
          mime = mime or "image/jpeg"
          data = _base64.b64encode(logo_path.read_bytes()).decode()
          return f"data:{mime};base64,{data}"
      except Exception as exc:
          log.warning("[email] No se pudo cargar logo para '%s': %s", slug, exc)
          return ""
  ```

- [ ] **Step 2: Actualizar `_base` para incluir el logo cuando existe**

  En la función `_base`, agregar el parámetro `logo_uri` y actualizar el template HTML:

  ```python
  def _base(titulo: str, cuerpo: str, cfg: Optional[dict] = None, logo_uri: str = "") -> str:
      nombre = _b(cfg, "empresa_nombre")
      color  = _b(cfg, "empresa_color")
      nit    = _b(cfg, "empresa_nit")
      tel    = _b(cfg, "empresa_tel")
      dir_   = _b(cfg, "empresa_dir")
      dept   = _b(cfg, "empresa_dept")

      logo_html = ""
      if logo_uri:
          logo_html = f'<img src="{logo_uri}" alt="{nombre}" style="max-height:48px;max-width:160px;object-fit:contain;vertical-align:middle;margin-right:12px">'

      return f"""
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px">
        <div style="background:{color};padding:16px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:12px">
          {logo_html}
          <div>
            <h2 style="color:#fff;margin:0;font-size:18px;letter-spacing:1px">{nombre}</h2>
            <p style="color:rgba(255,255,255,0.75);margin:2px 0 0;font-size:12px">{dept}</p>
          </div>
        </div>
        <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none">
          <h3 style="color:#111827;margin-top:0;font-size:16px">{titulo}</h3>
          {cuerpo}
          <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:11px;margin:0">
            Este correo fue generado automáticamente por el sistema de compras de {nombre}.
            Por favor no responda a este mensaje.
          </p>
        </div>
        <div style="background:#f9fafb;padding:10px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center">
            {nombre}{f' · NIT: {nit}' if nit else ''} · {dir_} · {f'PBX: {tel}' if tel else ''}
          </p>
        </div>
      </div>
      """
  ```

- [ ] **Step 3: Actualizar los generadores HTML para pasar el logo**

  Cada función `_html_*` debe obtener el logo y pasarlo a `_base`. Patrón a aplicar en todas:

  ```python
  # En _html_en_gestion (y similar para las demás):
  def _html_en_gestion(s: "SolicitudOC", cfg: Optional[dict] = None) -> str:
      logo_uri = _logo_base64(s.plataforma)
      # ... (código existente) ...
      return _base("Tu solicitud está siendo gestionada", cuerpo, cfg, logo_uri=logo_uri)
  ```

  Funciones a actualizar: `_html_en_gestion`, `_html_cotizacion_lista`, `_html_aprobacion_directora`, `_html_oc_enviada`, `_html_oc_proveedor`, `_html_nueva_solicitud_interna`, `_html_entrega_confirmada`, `_html_rechazo_cotizacion`.

---

## Task 7: Frontend — Botón Generar OC con SVG + plataformas desde API + fix alert()

**Files:**
- Modify: `frontend/src/pages/oc/SolicitudDetallePage.tsx`

- [ ] **Step 1: Agregar hook para leer plataformas desde el backend**

  En el archivo `frontend/src/hooks/useOC.ts` (o donde estén los hooks OC), agregar:

  ```typescript
  export interface PlataformaOption {
    slug: string
    nombre: string
  }

  export function usePlataformas() {
    const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"
    const token = useAuthStore((s) => s.token)

    return useQuery<PlataformaOption[]>({
      queryKey: ["oc", "plataformas"],
      queryFn: async () => {
        const r = await fetch(`${BASE_URL}/api/oc/plataformas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!r.ok) throw new Error("Error cargando plataformas")
        return r.json()
      },
      staleTime: 1000 * 60 * 60, // 1 hora — rara vez cambia
    })
  }
  ```

- [ ] **Step 2: Reemplazar emoji 🖨️ con SVG en el panel Generar OC**

  En `SolicitudDetallePage.tsx`, en el componente `PanelOrdenCompra`, reemplazar:

  ```tsx
  {/* ANTES */}
  <span className="text-brand-blue text-lg">🖨️</span>

  {/* DESPUÉS */}
  <svg className="w-5 h-5 text-brand-blue shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
  ```

- [ ] **Step 3: Reemplazar opciones hardcodeadas de plataforma con datos del hook**

  Importar el hook en el componente y reemplazar el select estático:

  ```tsx
  // Agregar en el componente PanelOrdenCompra:
  const { data: plataformasDisponibles = [] } = usePlataformas()

  // Reemplazar el select hardcodeado:
  {/* ANTES */}
  {/*
  <option value="logimat">LOGIMAT S.A.S.</option>
  <option value="imc cargo">IMC Cargo International S.A.S.</option>
  <option value="imc depósito">IMC Depósito S.A.S.</option>
  */}

  {/* DESPUÉS */}
  {plataformasDisponibles.map((p) => (
    <option key={p.slug} value={p.slug}>
      {p.nombre}
    </option>
  ))}
  ```

  Aplicar el mismo cambio al select de "Otro formato" (regenerar).

- [ ] **Step 4: Reemplazar `alert()` con estado de error inline**

  En `SolicitudDetallePage.tsx`, en la función `handleGenerarOC`:

  ```tsx
  // Agregar estado de error en el componente padre (donde está handleGenerarOC):
  const [errorOC, setErrorOC] = useState<string | null>(null)

  // Reemplazar el alert:
  // ANTES:
  // onError: () => alert("Error al generar la OC. Verifica que la cotización esté aprobada y vuelve a intentarlo."),

  // DESPUÉS:
  onError: () => setErrorOC("Error al generar la OC. Verifica que la cotización esté aprobada y vuelve a intentarlo."),
  onSuccess: () => setErrorOC(null),
  ```

  Y renderizar el error debajo del panel de OC:
  ```tsx
  {errorOC && (
    <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
      {errorOC}
    </div>
  )}
  ```

- [ ] **Step 5: Verificar que el frontend compila sin errores TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | tail -10
  ```

  Resultado esperado: sin errores.

---

## Task 8: Verificación de seguridad — confirmación final

- [ ] **Step 1: Confirmar que ningún NIT queda en el código fuente Python**

  ```bash
  grep -rn "830\.103\|830\.513\|900\.907" backend/app/ --include="*.py"
  ```

  Resultado esperado: 0 resultados. Si aparece alguno, removerlo y moverlo al `config.json` correspondiente.

- [ ] **Step 2: Confirmar que `_BRANDING_DEFAULTS` no tiene datos corporativos reales**

  ```bash
  grep -A 10 "_BRANDING_DEFAULTS" backend/app/services/email_service.py
  ```

  Resultado esperado: Solo debe mostrar "Conexiones Logísticas" sin NITs ni teléfonos específicos.

- [ ] **Step 3: Confirmar que no hay secrets en ningún archivo Python del módulo OC**

  ```bash
  grep -rn "AIza\|sk-\|password\|passwd\|secret" backend/app/routers/oc/ backend/app/services/ --include="*.py" | grep -v "smtp_password\|MAIL_PASSWORD\|settings\."
  ```

  Resultado esperado: 0 resultados.

---

## Orden de implementación recomendado

```
Task 2 → Task 4 → Task 3 → Task 1 → Task 5 → Task 6 → Task 7 → Task 8
```

Razón: Los config.json (Task 2) y field_synonyms (Task 4) no dependen de nada más. El fix del PDF (Task 3) es independiente. El endpoint de plataformas (Task 1) debe existir antes de que el frontend (Task 7) lo consuma. El email service (Tasks 5 y 6) puede ir en paralelo con Tasks 1-4.

---

## Self-review

**Cobertura de spec:**
- ✅ Bug subtotal/IVA/total confundidos en PDF (Task 3)
- ✅ Motor extracción "precio neto" ambiguo (Task 4)
- ✅ Correo por plataforma: SÍ se puede — implementado (Task 5)
- ✅ Nombre "CONEXIONES LOGÍSTICAS" como fallback (Task 5, Step 1)
- ✅ NITs y datos sensibles fuera del código (Task 5, Task 2, Task 8)
- ✅ Logos en correos (Task 6)
- ✅ Botón Generar OC: SVG, plataformas dinámicas, fix alert() (Task 7)
- ✅ Fallback XLSX removido de email_service (Task 5, Step 4)
- ✅ Verificación de seguridad (Task 8)

**Placeholder scan:** Sin placeholders — todas las tareas tienen código completo.

**Consistencia de tipos:**
- `_load_platform_branding(plataforma: str | None)` — usado en Task 5, llamado en `_get_runtime_config`
- `_logo_base64(plataforma: str | None)` — usado en Task 6, llamado en los generadores HTML
- `PlataformaOption { slug, nombre }` — definido en Task 7, coincide con el endpoint de Task 1
- `usePlataformas()` retorna `PlataformaOption[]` — coincide con el tipo definido
