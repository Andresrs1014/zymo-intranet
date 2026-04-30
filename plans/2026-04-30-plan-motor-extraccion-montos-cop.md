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
