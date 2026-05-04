# Mejoras UX módulo Financiero — listado, comparación OC vs factura y validación

## Contexto

El módulo Financiero (`/financiero`, `FacturasPage`, `FacturaDetallePage`) ya expone datos de OC, cotizaciones, factura, validación automática Man vs OC (`POST .../validar`), cuentas contables y bitácora. En **servidor / usuarios reales** la percepción es que **poco está claro**: mucha información en vertical, la **comparación** entre referencia de compra y factura es **implícita** (hay que leer dos bloques separados), las **pestañas del listado** se interpretan distinto de lo que filtran, y la **validación** casi no se ve hasta después de ejecutarla.

Este documento define el **alcance de producto y UI** para que un implementador (p. ej. Claude Code) lo ejecute sin re-descubrir el análisis previo.

## Objetivos

1. **Listado de facturas:** que cada pestaña sea **inequívoca** (copy + opcional contadores + subtítulos).
2. **Detalle:** una sección **visible y dedicada** que muestre **comparación lado a lado (o tabla de tres columnas)** entre datos **de referencia OC** (lo que ya muestra «Información de la OC») y **factura** (campos editables o valores guardados).
3. **Validación:** la sección de resultado **no debe “desaparecer”** cuando aún no hay filas: **estado vacío** + CTA para **«Correr validación»** (reutilizar el flujo existente).
4. **Legibilidad:** mapear claves técnicas de `ValidacionFactura.campo` (`valor`, `nit_proveedor`, `nombre_proveedor`) a **etiquetas en español** para contabilidad (frontend o API).

## No objetivos (salvo acuerdo explícito)

- Cambiar la **lógica numérica** de tolerancia ni las reglas de `_ejecutar_validacion` en `backend/app/routers/financiero/facturas.py` (solo si se detecta bug).
- Rediseño total del sidebar o branding.
- Nueva API de comparación si se puede componer con `useSolicitudFinancieroDetalle` + `factura` + `validaciones` existentes.

## Archivos principales a tocar

| Área | Ruta |
|------|------|
| Listado | `frontend/src/pages/financiero/FacturasPage.tsx` |
| Detalle | `frontend/src/pages/financiero/FacturaDetallePage.tsx` |
| Tipos | `frontend/src/types/financiero.ts` (solo si hace falta helpers) |
| Hooks | `frontend/src/hooks/useFinanciero.ts` (solo si hace falta) |
| Backend validación | `backend/app/routers/financiero/facturas.py` — **solo** si se elige exponer `campo_label` desde API; si no, mapeo solo en frontend |

## Tarea 1 — Pestañas del listado (`FacturasPage`)

**Problema actual:** `pendiente`, `validada`, `con_diferencias` filtran por `solicitud.factura_estado`. Las solicitudes **sin** `factura_id` no tienen ese estado en el mismo sentido; quedan sobre todo en **«Sin factura»**. Los usuarios suelen leer **«Pendientes»** como “falta algo por hacer”, no como “factura en estado pendiente de validación”.

**Implementación sugerida:**

- Renombrar la pestaña `pendiente` a algo explícito, p. ej. **«Pendiente de validar»** o **«Factura sin validar»** (elegir uno y unificar).
- Bajo el bloque de pestañas, **una línea de ayuda** dinámica o estática: qué incluye cada tab (1 frase corta).
- Opcional pero valioso: **badge con conteo** por tab sobre el mismo criterio de filtro que `filtradas` (calcular `solicitudes.filter(...).length` por tab).

**Criterio de aceptación:** un usuario nuevo entiende sin adivinar que «Sin factura» ≠ «Pendiente de validar».

## Tarea 2 — Sección «Conciliar OC vs factura» (`FacturaDetallePage`)

**Problema actual:** «Información de la OC» y «Factura del proveedor» están separados verticalmente; la **comparación** (NIT, razón social, valor) es trabajo del usuario.

**Implementación sugerida:**

- Añadir un bloque **compacto** (card) **después** de tener `factura` cargado (o cuando `solicitud.factura_id` exista y se esté cargando factura — manejar estado de carga con mensaje breve).
- Contenido mínimo en formato **tabla o grid 2 columnas** (o 3: Referencia OC | Factura | estado visual opcional):
  - **Valor:** `solicitud.valor_aprobado` (o el que sea la referencia única que ya muestra el bloque OC) vs `form.valor_factura` / `factura.valor_factura` (lo que refleje lo guardado vs edición local — definir una regla clara para no mentir si hay `formDirty`).
  - **NIT:** proveedor en OC/cotización aprobada (ya expuesto en detalle como parte de `solicitud` / flujo actual) vs `nit_proveedor` de factura.
  - **Razón social / nombre proveedor:** vs `nombre_proveedor` de factura.
- Reutilizar `formatCOP` donde aplique.
- **No duplicar** todo el grid largo de «Información de la OC»; este bloque es solo **campos de alto valor para conciliación**. El bloque OC detallado puede quedar debajo o encima según flujo; lo importante es **una sola mirada** para conciliar.

**Criterio de aceptación:** sin hacer scroll entre dos secciones lejanas, el usuario ve **pares OC / factura** para los campos que la validación ya compara.

## Tarea 3 — Validación siempre visible + etiquetas (`FacturaDetallePage`)

**Problema actual:** «Resultado de validación» solo renderiza si `validaciones.length > 0`. Antes del primer run no hay ancla visual fuerte.

**Implementación sugerida:**

- Renderizar **siempre** la sección «Validación» cuando exista `factura` (registro de factura creado), con:
  - **Si `validaciones.length === 0`:** texto tipo *«Aún no se ha ejecutado la validación frente a la OC»* + botón **«Correr validación»** (mismo handler que `handleValidar`).
  - **Si hay filas:** mantener tabla actual; opcionalmente integrar con el bloque comparación (no obligatorio en v1).
- Mapeo `campo` → etiqueta legible, p. ej.:
  - `valor` → «Valor total» o «Valor (comparado con OC)»
  - `nit_proveedor` → «NIT proveedor»
  - `nombre_proveedor` → «Razón social / nombre proveedor»
- Implementar el mapa en un helper tipo `labelValidacionCampo(campo: string): string` en el mismo archivo o `lib/financieroLabels.ts`.

**Criterio de aceptación:** antes de pulsar validar, el usuario **ve** dónde ocurrirá el resultado; después, **no ve** claves crudas como `nit_proveedor` como título principal de fila.

## Tarea 4 — Cotizaciones: referencia explícita (opcional pero recomendado)

**Problema actual:** tabla «Cotizaciones del proceso» lista varias filas; no siempre queda claro cuál es la **cotización que amarró la OC** usada para validar.

**Implementación sugerida (ligera):**

- Si el detalle de solicitud expone `cotizacion_id` (aprobada) o equivalente, **marcar** la fila en la tabla que coincida con ese id (badge *«Referencia OC»* o fila resaltada).
- Si no hay id en el payload del detalle, revisar `useSolicitudFinancieroDetalle` / endpoint y **añadir** `cotizacion_id` de referencia si es trivial en backend.

**Criterio de aceptación:** a simple vista se distingue la cotización **normativa** del resto.

## Orden sugerido de PR / commits

1. Labels de validación + sección validación con empty state (cambio acotado, fácil de revisar).
2. Bloque comparación OC vs factura.
3. Pestañas y copy en `FacturasPage`.
4. Realce de cotización de referencia (si requiere API, hacerlo después de coordinar campo).

## Pruebas manuales mínimas

- [ ] Listado: cambiar de tab y verificar conteos/copy si se implementaron.
- [ ] Detalle con factura sin validar: se ve sección validación vacía + botón.
- [ ] Tras «Correr validación»: etiquetas humanas y datos coherentes con OC.
- [ ] Comparación: valores NIT/nombre/valor reflejan OC vs factura sin contradecir el formulario en borrador (definir si se muestra “guardado” vs “en edición” según `formDirty`).

## Notas para Claude Code

- Mantener **estética** alineada con Tailwind existente (`brand-blue`, cards `rounded-xl border`, tipografía actual).
- **Accesibilidad:** botones con `type="button"` donde corresponda; textos de ayuda no solo `title`.
- Si el bloque comparación y la tabla de validación **redundan**, está bien en v1; en v2 se puede condensar mostrando ✓/✗ en la comparación usando `validaciones` cuando existan.

## Referencia de lógica backend (solo lectura)

Validación: `POST /api/financiero/facturas/{factura_id}/validar` ejecuta `_ejecutar_validacion` y persiste filas `fin_validaciones` con `campo` ∈ `valor`, `nit_proveedor`, `nombre_proveedor`. Los campos esperados salen de **cotización asociada a la orden** (`CotizacionProveedor` vinculada a `OrdenCompra`).
