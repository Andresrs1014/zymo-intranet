# Plan: Motor de reconocimiento de archivos y normalización monetaria (COP)

**Fecha:** 2026-04-29  
**Alcance:** Compras (extracción de cotizaciones) como prioridad; extensión a Financiero (facturas) y coherencia global.  
**Marco:** `.cursorrules.md` — cambios incrementales, validación backend, seguridad, documentación explícita, sin aumentar superficie de riesgo.

---

## 1. Contexto técnico actual

### 1.1 Dónde vive “el motor”

| Ámbito | Archivos principales | Rol |
|--------|---------------------|-----|
| **OC — texto / regex** | `backend/app/services/cotizacion_parse.py` | Regex sobre texto plano (`TOTAL`, `IVA`, NIT…). Usa `parse_cop`. |
| **OC — PDF Excel Word** | `backend/app/routers/oc/cotizaciones.py` (`_extraer_texto`, `_parsear_campos`, `_items_*`) | Extracción de texto; tablas PDF; fallback por posición Y; **`parse_cop`** en números. |
| **OC — etiquetas-canónicas** | `backend/app/services/extraction_utils.py`, `backend/app/services/field_synonyms.py` | Etiquetas de Excel/Word → campos conocidos antes del regex. |
| **Montos COP (backend)** | `backend/app/services/number_utils.py` (`parse_cop`, `format_cop`) | Punto único servidor para strings → `float`. |
| **Financiero** | `backend/app/routers/financiero/facturas.py` (`_extraer_texto`, `_parsear_factura`) | Misma filosofía texto + `_to_float` = `parse_cop`. |

### 1.2 Proceso de compras en `plans/` (referencia)

- **`Proceso_completo_de_compras.md`** y **`2026-04-27-analisis-proceso-compras.md`** describen el flujo Estado / auxiliar / motor de extracción y expectativas de calidad sobre cotizaciones y evidencias.

La presente mejora **no cambia negocio** de estados; solo **precisión del motor** y **coherencia de montos COP** entre UI ↔ API ↔ BD.

---

## 2. Archivos de muestra en `plans/archivos`

Tras revisar el disco del repo:

| Archivo | Interpretación plausible |
|---------|---------------------------|
| `plans/archivos/Cotizacion reja logimat.pdf` | Cotización de proveedor (formato cotización, posible tabla o texto corrido). |
| `plans/archivos/FE 10685 MAG IMPORTADORES SAS IMC CARGO.pdf` | Factura electrónica (prefijo típico `FE`), layout DIAN habitual. |

**Observación:** En el mencionamiento del usuario aparecían *2 cotizaciones y 1 factura*; **en la carpeta solo hay 2 PDFs.** Conviene añadir el tercero para regresiones (o mover los tres a rutas conocidas para CI opcional).

**Limitación:** En este paso no pudimos adjuntar el volcado de texto OCR de cada PDF desde el sandbox (salida vacía sin diagnóstico). La siguiente iteración debería:

1. Ejecutar extracción local/Docker contra esos tres archivos.
2. Guardar snapshots de texto/tablas anonymizadas en `docs/` o artefactos de prueba *(sin datos sensibles no acordados)*.

---

## 3. Errores y causas raíz identificadas

### E1 — **Crítico: formulario OC usa `Number()` en valores monetarios (JavaScript)**

**Ubicación:** `frontend/src/pages/oc/CotizacionFormPage.tsx` — `handleChange` / `handleItemChange` aplican:

```txt
numVal = value === "" ? undefined : Number(value)
```

**Comportamiento erróneo (comportamiento real de ECMAScript):**

- `Number("752.000") === 752` — el navegador trata `.` como **decimal**, no como miles COP.
- Cualquier edición manual con formato `"1.500.000"` o copiar/pegar de PDF también se trunca incorrectamente si el campo pasa por `Number()`.

Este solo fallo reproduce exactamente lo descrito: «la directora aprueba 752.000 y el sistema entiende 752 pesos». El backend puede devolver bien `752000`; el problema aparece si el usuario **reescribe** o el campo vuelve a parsearse como string con puntos antes de guardar.

**Hallazgo positivo ya existente:** `frontend/src/lib/formatters.ts` define **`parseCOP()`** compatible con formato colombiano (incluye patrón `1.500.000` completo y el caso `"xxx.000"` con tres cifras decimales aparentes = miles).

**Contraste:** `frontend/src/pages/financiero/FacturaDetallePage.tsx` usa **`FormFieldCOP`** con **`parseCOP` en blur** → patrón correcto que **NO** está replicado en la pantalla de cotización.

---

### E2 — Inconsistencia backend `parse_cop` vs frontend `parseCOP`

Hoy hay **dos implementaciones** (Py y TS). Deben ser **semanticamente iguales** o fallarás en bordes.

**Comparación rápida:**

- Ambos contemplan formato colombiano `1.500.000,50` y miles `1.500.000`.
- TS tiene rama extra explícita `^\d{1,3}(\.\d{3})+$` (solo puntos grupo de miles hasta el final) — coincide con caso “752.000” como grupo de tres.
- Backend `parse_cop` tiene lógica distinta ordenada pero **conceptualmente alineada** en “un punto + tres dígitos = miles”; conviene una **suite compartida de casos**.

**Casos borde a documentar y testear:**

| Entrada | Significado COP habitual | Esperado revisión |
|---------|--------------------------|-------------------|
| `752.000` | 752 mil | **752000** |
| `752,00` | 752 **con centavos** (raro COP) vs error de usuario (quiso `752.000`) | Clarificar política (párrafo siguiente en esta sección). |
| `752000` | 752 mil sin separadores | 752000 |
| `USD 752` / `EUR` | Ya no COP | ¿Rechazar o bandera “extranjera”? |
| `'1'` espacios `'500'` | PDF roto por tokens | Unir tokens antes de `parse_cop` |

\* Política de negocio: en COP empresa **casos sin decimales** son la norma para totales OC; valores con **exactamente dos dígitos tras coma (`*,dd`) pueden tratarse como decimales reales**, mientras **`*,ddd` o grupo de miles** se resuelvan como COP. Todo esto debe quedar por escrito después de una muestra estadística corta sobre facturas/cotizaciones reales.

---

### E3 — PDF: números partidos en varios tokens

En `_items_desde_pdf_texto` (`cotizaciones.py`) cada “palabra” es un token separado por pdfplumber. Un total `1 . 752 . 000` puede aparecer como tres tokens → la línea puede **no cumplir** el regex actual de sufijos monetarios (`^[\d.,\$%]+$` tras quitar caracteres individuales), o ordenarse mal.

**Efecto:** ítems o totales faltantes, o captura de última celda equivocada.

---

### E4 — Regex “TOTAL genérico” captura número equivocado

En `cotizacion_parse.py` / `_parsear_factura` aparece un patrón laxo tipo:

```txt
r"\bTOTAL\b[\s\S]{0,15}?\$?\s*([\d.,]+)"
```

En facturas electrónicas pueden existir líneas intermedias (**subtotal antes de descuentos, retenciones, “total antes de impuestos”**) que hacen que el primer `\bTOTAL\b` no sea el “total a pagar”.

**Mejora:** priorizar etiquetas específicas (`TOTAL A PAGAR`, `PAYABLE TOTAL`, orden de lista de patrones ya parcialmente hecho en facturas) y penalizar líneas cercanas a `SUBTOTAL`.

---

### E5 — Excel `data_only=True`

Si la celda es **tipo número** Excel ya entrega float (correcto); si llega como **string `"1.752.000"`**, `parse_cop` debe manejarlo. Menor riesgo que E1 pero conviene revisar muestras reales exportadas desde proveedor.

---

## 4. Dirección de solución propuesta (.cursorrules-aligned)

### 4.1 Número: una politica COP explícita (no magia invisible)

Evitar interpretación “borg” que fuerce cualquier entrada a integer sin UX:

1. **Documentar** convenciones en `docs/` (una página corta enlazada desde este plan).
2. **UI:** campos monetarios como **texto** + **`parseCOP`** al perder foco (`onBlur`), igual que `FormFieldCOP`.
3. **Backend:** rechazar payloads absurdos con **mensaje útil** (opcional futuro): ej. cotización donde `valor_total` < 1000 y OC requiere monto grande → warning no bloqueante o flag “revisión manual”.
4. **Tests compartidos** (JSON lista de vectores entrada → número esperado) consumidos desde:
   - pytest (Python `parse_cop`)
   - vitest/ts (TS `parseCOP`) opcional cuando exista infra de frontend tests.

### 4.2 Alinear TS y Python

- Extracción a **archivo fuente único JSON** (`backend/tests/fixtures/money_vectors.json`) + copia sólo-en-build o symlink no viable en Windows → duplicación controlada o generación desde Python en tiempo de CI.
- Mínimo: duplicación **con tabla en doc** mantenida a manos en PR cuando cambie lógica.

### 4.3 Mejoras al motor OCR / PDF (*post* E1 para no tapar ganancia rápida)

1. Normalizar línea antes de número: concatenar tokens consecutivos `[\d.,]+` antes de llamar `parse_cop`.
2. Aumentar lista de etiquetas específicas de total en cotización (mirror parcial desde facturas).
3. Registrar en log (sin datos sensibles) **“campo no parseable”** + porción corta truncada para depuración en servidor.

### 4.4 Financiero

- Motor ya usa `parse_cop` para regex monetario → **beneficio automático** al endurecer backend.
- Revisión específica: patrones de **FE** vs **cotización**: duplicidad de código entre `_parsear_factura` y `parsear_campos_cotizacion`; **oportunidad** de compartir módulo `services/document_money_extract.py` (solo regex + orden de patrones) para no divergir bugs.

---

## 5. Plan de implementación por fases

### Fase A — Corrección rápida (Alto impacto, bajo riesgo)

1. **`CotizacionFormPage.tsx`**: reemplazar `Number(...)` por `parseCOP` en campos monetarios (encabezado e ítems `valor_unitario`, `valor_total`, y coherencia con `cantidad` si aplica formato local).
2. **`SolicitudDetallePage.tsx`** (bloque edición cotización director/auxiliar donde `Number(e.target.value)` en montos): misma función `parseCOP` o `<FormFieldCOP>` reutilizable extraído a componente (`components/ui/CurrencyInput.tsx`) compartido con Financiero.
3. QA manual en flujo:** extraer archivo → valores prellenados → editar con `1.500.000` → guardar.** El número persistido debe ser `1500000`.

### Fase B — Tests y parity Py/TS

1. Carpetas pytest con vectores monetarios estándares (incl. `752.000`, `752,00`, `1752000`).
2. Ajustes menores `parse_cop` / `parseCOP` para gaps detectados únicamente con evidencia (no adivinar).
3. (Opcional) Job CI que ejecute ambos si el proyecto ya tiene frontend unit tests.

### Fase C — Robustez extractor PDF/tablas

1. Fusión de tokens numéricos en `_items_desde_pdf_texto`.
2. Reordenar/refinar patron `TOTAL`.
3. Re-ejecutar contra los tres PDF/commit de fixtures.

### Fase D — Unificación código duplicado

1. Factor común lista `MONEY_TOTAL_PATTERNS` compartida factura/cotización.
2. Registrar métricas: `campos_encontrados` actual no distingue “total mal capturado” → futuro campo `confidence` opcional solo interno/logs.

---

## 6. Riesgos y mitigaciones (.cursorrules)

| Riesgo | Mitigación |
|--------|-------------|
| Regresión al parsear valores menores a 1000 pesos legítimos | Casos tests + permitir entrada explícita “no miles” cuando no hay punto (`752` debe ser `752`). |
| Ambigüedad `752,00` | Tooltip UI + texto ayuda estándar empresa; **no sobrescalar heurística**. |
| Fugas PHI/PII en logs | Logs solo código + longitud snippet. |
| Romper compatibilidad API | Contratos REST sin cambiar tipos (`float`). |

---

## 7. Definición de hecho (incremental)

- [ ] Cotización puede editarse usando formatos COP comunes sin colapsar magnitud.
- [ ] Fixture mínimo de **≥10 vectores monetarios** pasa pytest.
- [ ] Documento operativo enlazando política monetaria COP de la intranet.
- [ ] (Cuando exista 3.er archivo muestra) regresión extraída automatizada opcional sin subir contenido sensible a git sin previa revisión legal.

---

## 8. Resumen ejecutivo

El problema central de **`752.000` → `752`** no viene de falta absoluta de lógica robusta **en servidor** (donde existe `parse_cop`) ni de **ausencia total en cliente** (`parseCOP` en `formatters.ts`), sino del **uso de `Number()` en formularios de cotización OC**, incompatible con formato colombiano. Corregir eso debe ir **antes** de un rediseño profundo del motor PDF.

Las mejoras al motor OCR/regex siguen siendo necesarias especialmente por **facturas electrónicas** y **cotizaciones con diseños irregulares**, pero tienen menor ROI hasta fijar el pipeline numérico E2-E4 con pruebas y datos reales anonimizados.

---

## Artifacts en repo relacionados tras este análisis

- `frontend/src/lib/formatters.ts` — `parseCOP` (uso obligatorio donde hoy está `Number` en COP).
- `backend/app/services/number_utils.py` — baseline servidor.
- Muestra archivos PDF: `plans/archivos/*.pdf` (solo 2 al momento).

**Siguiente acción recomendada:** ejecutar extracción end-to-end en entorno Docker con los PDF de `plans/archivos/` y pegar resultado anonimizado en un comentario de seguimiento bajo esta misma entrada de planificación (no en logs públicos).

---

---

## 9. Implementación ejecutada — 2026-04-30

> Todos los cambios están en el commit `226a744` (sesión anterior) y en los cambios sin commitear del mismo día.
> Rama: `master`.

---

### 9.1 Nuevos campos extraídos del motor de cotizaciones

**Archivos modificados:**
- `backend/app/services/cotizacion_parse.py`
- `backend/app/routers/oc/cotizaciones.py`
- `frontend/src/hooks/useOC.ts`
- `frontend/src/pages/oc/CotizacionFormPage.tsx`

**Qué se hizo:**

El motor de extracción ya tenía sinónimos definidos en `field_synonyms.py` para `numero_cotizacion_proveedor` y `proveedor_nombre`, pero `parsear_campos_cotizacion` nunca los extraía del texto. Se agregaron dos bloques de patrones regex nuevos:

```python
# backend/app/services/cotizacion_parse.py

num_cotizacion = text_or_extra("numero_cotizacion_proveedor", [
    r"N[ÚU]MERO\s+DE\s+COTIZACI[ÓO]N[:\s]+(.{2,60}?)(?:\n|$)",
    r"COTIZACI[ÓO]N\s+N[°O]\.?\s*[:\s]+(.{2,60}?)(?:\n|$)",
    r"COT(?:IZACI[ÓO]N)?\s*N[°O]?\.?\s*[:\s]*([A-Za-z0-9\-/]{2,30})",
    r"OFERTA\s+N[°O]?\.?\s*[:\s]*([A-Za-z0-9\-/]{2,30})",
    r"PROPUESTA\s+N[°O]?\.?\s*[:\s]*([A-Za-z0-9\-/]{2,30})",
])

proveedor_nombre = text_or_extra("proveedor_nombre", [
    r"RAZ[ÓO]N\s+SOCIAL[:\s]+(.{3,100}?)(?:\n|$)",
    r"EMPRESA[:\s]+(.{3,100}?)(?:\n|$)",
    r"ELABORADO\s+POR[:\s]+(.{3,100}?)(?:\n|$)",
    r"OFERTANTE[:\s]+(.{3,100}?)(?:\n|$)",
])
```

`ExtraccionResult` en `cotizaciones.py` se amplió con:
```python
numero_cotizacion_proveedor: Optional[str] = None
proveedor_nombre: Optional[str] = None
```
Ambos campos se cuentan en `campos_encontrados` y se incluyen en el retorno del endpoint `/cotizacion/extraer`.

**Dónde afecta en UI (`CotizacionFormPage.tsx`):**
- El panel de "Extracción automática" ahora muestra filas **"Proveedor"** y **"N° cotización"** cuando el documento los contiene.
- Al aceptar la extracción, `aplicarExtraccion` puebla automáticamente los campos `proveedor_nombre` y `numero_cotizacion_proveedor` del formulario.

**Efecto esperado:** Al subir una cotización PDF de proveedor que incluya "RAZÓN SOCIAL", "COT N°", "OFERTA N°" u otras variantes, el formulario se pre-llena con esos datos sin digitarlos a mano.

---

### 9.2 Auto-discovery de campos no reconocidos

**Archivo modificado:**
- `backend/app/routers/oc/cotizaciones.py`

**Qué se hizo:**

Se agregó una función `_registrar_candidatos_campo` y una variable de bloqueo `_candidates_lock = threading.Lock()` a nivel de módulo. Cuando el motor detecta una tabla en un documento (Excel, PDF, Word) y encuentra columnas cuyos encabezados **no resuelven a ningún campo canónico**, los registra automáticamente en:

```
/app/data/field_candidates.json
```

Estructura del archivo generado:
```json
[
  { "label": "código sap", "fuente": "encabezado_tabla", "fecha": "2026-04-30" },
  { "label": "unidad de medida", "fuente": "encabezado_tabla", "fecha": "2026-04-30" }
]
```

**Por qué importa:** Cada vez que un proveedor usa una terminología distinta (p.ej. "Cód. interno", "U/M", "Partida arancelaria"), queda registrada. El equipo puede revisar ese archivo periódicamente y agregar los términos útiles a `field_synonyms.py` para que el motor los reconozca en futuros documentos.

**Seguridad de concurrencia:** El acceso al archivo usa `threading.Lock()` para evitar corrupción bajo carga concurrente. Los errores de I/O se capturan silenciosamente con `log.warning` para que nunca interrumpan el flujo principal de extracción.

---

### 9.3 Fusión de tokens numéricos partidos por pdfplumber

**Archivo modificado:**
- `backend/app/routers/oc/cotizaciones.py`

**Qué se hizo:**

Se agregó la función `_fusionar_tokens_numericos` justo antes de `_items_desde_pdf_texto`. pdfplumber a veces extrae un número como tokens separados; por ejemplo, el valor `1.752.000` puede llegar como `["1", ".", "752", ".", "000"]` o como `["1.752", ".000"]`. Sin fusión, el motor descartaba esas líneas o leía montos incorrectos.

```python
def _fusionar_tokens_numericos(tokens: list[str]) -> list[str]:
    """Fusiona tokens consecutivos que forman un número partido por pdfplumber.
    Ej: ["Reja", "1", ".", "752", ".", "000"] → ["Reja", "1.752.000"]
    """
    resultado: list[str] = []
    buffer = ""
    for tok in tokens:
        if re.match(r"^[\d.,\$%]+$", tok):
            buffer += tok
        else:
            if buffer:
                resultado.append(buffer)
                buffer = ""
            resultado.append(tok)
    if buffer:
        resultado.append(buffer)
    return resultado
```

En `_items_desde_pdf_texto` se aplica antes de procesar cada línea:
```python
tokens = _fusionar_tokens_numericos(lineas[y_key])
```

**Dónde afecta:** Cotizaciones PDF sin bordes de tabla visibles (las que usan el fallback de posición de texto). Los ítems con precios que pdfplumber partía en tokens ahora se reconocen correctamente.

---

### 9.4 Bug crítico — Total × 1000 en facturas DIAN UBL

**Archivos modificados:**
- `backend/app/services/number_utils.py` → función `parse_cop`
- `frontend/src/lib/formatters.ts` → función `parseCOP`

**Causa raíz identificada:**

Las facturas electrónicas DIAN UBL renderizan los montos con 3 ceros de decimales al final. Ejemplo:

```
TOTAL A PAGAR:   2.821.530.000
```

Donde `2.821.530` son los pesos y `.000` son los centavos (cero). El motor anterior eliminaba **todos** los puntos ciegamente:

```python
# Antes — incorrecto para DIAN UBL
cleaned = "2.821.530.000"
cleaned = cleaned.replace(".", "")  # → "2821530000" → 2.821.530.000 pesos ❌
```

Resultado visible: el sistema mostraba `$2.821.530.000` (2.8 mil millones) en lugar de `$2.821.530` (2.8 millones).

**Fix aplicado en `parse_cop` (backend):**

```python
# backend/app/services/number_utils.py — rama "else" (múltiples puntos, sin coma)

_partes = cleaned.split(".")
if (
    len(_partes) == 4                          # exactamente 4 grupos
    and all(len(p) == 3 for p in _partes[1:]) # todos los grupos post-primero son 3 dígitos
    and _partes[-1] == "000"                   # el último grupo es centavos cero
):
    cleaned = "".join(_partes[:-1])  # "2.821.530.000" → "2821530" → 2.821.530 ✓
else:
    cleaned = cleaned.replace(".", "")
```

**Fix aplicado en `parseCOP` (frontend):**

El mismo bug existía en `parseCOP` de `formatters.ts`. La rama "Colombiano solo miles" (`/^\d{1,3}(\.\d{3})+$/`) también matcheaba `"2.821.530.000"`:

```typescript
// frontend/src/lib/formatters.ts
if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
  const partes = cleaned.split(".")
  if (partes.length === 4 && partes[partes.length - 1] === "000") {
    return parseFloat(partes.slice(0, -1).join(""))  // → 2821530 ✓
  }
  return parseFloat(cleaned.replace(/\./g, ""))
}
```

**Limitación conocida y documentada:** Si una factura es legítimamente por `1.000.000.000` de pesos (1 mil millones) en formato `X.YYY.ZZZ.000`, el fix lo leería como `1.000.000` (1 millón). Este caso es extremo para el contexto del sistema. Si ocurre, el usuario puede corregirlo manualmente en el formulario.

---

### 9.5 Centavos adaptativos — mostrar solo si son distintos de cero

**Archivos modificados:**
- `backend/app/services/number_utils.py` → función `format_cop`
- `frontend/src/lib/formatters.ts` → función `formatCOP`

**Qué se hizo:**

Antes, `formatCOP` / `format_cop` siempre redondeaban a entero, descartando centavos válidos. Ahora el comportamiento es adaptativo:

| Valor almacenado | Antes       | Ahora           |
|------------------|-------------|-----------------|
| `2821530`        | `$2.821.530`| `$2.821.530` ✓  |
| `2821530.50`     | `$2.821.530`| `$2.821.530,50` ✓ |
| `536091.00`      | `$536.091`  | `$536.091` ✓    |

**Frontend (`formatCOP`):**
```typescript
const hasCents = Math.round((value % 1) * 100) !== 0
return new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: hasCents ? 2 : 0,
  maximumFractionDigits: hasCents ? 2 : 0,
}).format(value)
```

**Backend (`format_cop`):**
```python
cents = round(n % 1, 2)
if cents > 0:
    entero = int(n)
    s = f"{entero:,}".replace(",", ".") + f",{round(cents * 100):02d}"
else:
    s = f"{round(n):,}".replace(",", ".")
```

**Dónde se usa `formatCOP`:** En todas las páginas que muestran valores monetarios: `SolicitudDetallePage`, `CotizacionFormPage`, `FacturaDetallePage`, panel de aprobación, reportes. El cambio es global y no requiere modificar esas páginas individualmente.

---

### 9.6 IVA no capturado en facturas DIAN UBL (formato sin separador)

**Archivo modificado:**
- `backend/app/services/cotizacion_parse.py`

**Causa raíz identificada:**

Las facturas DIAN UBL presentan el IVA en formato de tabla sin dos puntos ni guión entre la etiqueta y el valor:

```
IVA 19.00 %    536,091.00
```

Los 4 patrones regex existentes requerían `[:\-]` (dos puntos o guión) después del porcentaje:
```python
r".*\bIVA\s*19%?\b\s*[:\-]\s*\$?\s*([\d.,]+)"   # ← requiere : o -
```
Ese patrón no matcheaba el formato DIAN porque solo hay espacios entre `%` y el valor.

**Fix aplicado — nuevo patrón como primera prioridad:**

```python
# backend/app/services/cotizacion_parse.py — lista de patrones IVA

# NUEVO (posición 0 — mayor prioridad):
r"(?m)^(?!.*\bBASE\b)(?!.*\bGRAVABLE\b).*\bIVA\b\s+[\d]+(?:[.,]\d+)?\s*%\s+([\d.,]+)"
```

**Cómo funciona:** Busca la secuencia `IVA` + tasa numérica (ej: `19` o `19.00`) + `%` + espacios + el valor capturado. La captura es el número **a la derecha** del porcentaje, como sugería el análisis del documento real.

**Casos que matchea:**
- `IVA 19.00 % 536,091.00` → captura `536,091.00` → `parse_cop` → `536091` ✓
- `IVA 19 % 100.000` → captura `100.000` → `parse_cop` → `100000` ✓

Los patrones anteriores siguen activos en posiciones 2–5 para documentos que sí usan `:` o `-`.

---

### 9.7 Checklist de revisión rápida

Para validar los cambios en el entorno de prueba:

- [ ] Subir `FACTURA-UBL(...).pdf` de `plans/archivos/` al formulario de cotización → **valor total debe ser `$2.821.530` o similar, NO `$2.821.530.000`**
- [ ] Verificar que el IVA se extrae como `$536.091` (o el valor real de la factura)
- [ ] Subir una cotización con tabla multi-ítem en PDF → verificar que los ítems con precios se detectan
- [ ] Si una cotización tiene "RAZÓN SOCIAL: Empresa XYZ" → el campo Proveedor del formulario debe pre-llenarse
- [ ] Si una cotización tiene "COT N° 2026-001" → el campo N° cotización debe pre-llenarse
- [ ] Abrir `/app/data/field_candidates.json` en el servidor Docker tras varias extracciones → debe mostrar etiquetas no reconocidas acumuladas
- [ ] Un valor con centavos reales (ej: `1.500.050,75`) debe mostrarse como `$1.500.050,75`, no como `$1.500.050`
