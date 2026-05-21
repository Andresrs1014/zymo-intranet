# Factura Detalle — Fase 1: Layout Comparativo con Visor PDF

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la sección "Factura del proveedor" en `FacturaDetallePage` con un layout de 2 columnas: izquierda = info OC (arriba) + formulario simplificado de 3 campos (abajo); derecha = visor PDF inline autenticado.

**Architecture:** Pequeño cambio de backend para exponer `items_cotizacion` y `aval_compra_solicitud` en el endpoint de detalle. Frontend: reemplaza la sección "Factura del proveedor" con un layout `grid-cols-2` de altura fija; el visor PDF crea un blob URL autenticado con axios y lo muestra en un `<iframe>`. El formulario queda reducido a 3 campos editables: número de factura, valor de factura, y fecha (auto-inicializada con hoy).

**Tech Stack:** FastAPI + SQLModel (Python), React 18, TypeScript, TailwindCSS, React Query v5, axios

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `backend/app/routers/financiero/facturas.py` |
| Modificar | `frontend/src/types/financiero.ts` |
| Modificar | `frontend/src/pages/financiero/FacturaDetallePage.tsx` |

---

## Task 1: Backend — exponer `items_cotizacion` y `aval_compra_solicitud`

**Files:**
- Modify: `backend/app/routers/financiero/facturas.py:47-88` (clase `SolicitudConFacturaRead`)
- Modify: `backend/app/routers/financiero/facturas.py:491-522` (función `_fila_solicitud_financiero`)

- [ ] **Step 1: Agregar campos a `SolicitudConFacturaRead`**

Ubicar la clase `SolicitudConFacturaRead` (~línea 47) y agregar dos campos al final, antes de `class Config`:

```python
# ── nuevos campos ──
aval_compra_solicitud: Optional[str] = None
items_cotizacion: Optional[list] = None  # [{num, descripcion, cantidad, valor_unitario, valor_total, ...}]
```

El resultado debe verse así al final de la clase:

```python
class SolicitudConFacturaRead(BaseModel):
    # ... campos existentes ...
    observaciones_seguimiento: Optional[str] = None
    seguimiento_updated_at: Optional[datetime] = None
    # nuevos
    aval_compra_solicitud: Optional[str] = None
    items_cotizacion: Optional[list] = None

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Poblar los nuevos campos en `_fila_solicitud_financiero`**

Ubicar el `return SolicitudConFacturaRead(...)` (~línea 491) y agregar al final del bloque de kwargs, antes del cierre del paréntesis:

```python
        aval_compra_solicitud=sol.aval_compra,
        items_cotizacion=cotizacion.items if cotizacion else None,
```

El final de la llamada debe quedar:

```python
    return SolicitudConFacturaRead(
        # ... kwargs existentes ...
        observaciones_seguimiento=seg.observaciones if seg else None,
        seguimiento_updated_at=seg.updated_at if seg else None,
        aval_compra_solicitud=sol.aval_compra,
        items_cotizacion=cotizacion.items if cotizacion else None,
    )
```

- [ ] **Step 3: Verificar manualmente que el endpoint devuelve los campos**

```bash
# Desde el directorio raíz del proyecto, con el servidor corriendo:
curl -s -H "Authorization: Bearer <token>" \
  http://localhost:8001/api/financiero/solicitudes/<cualquier-solicitud-id> \
  | python -m json.tool | grep -E "aval_compra_solicitud|items_cotizacion"
```

Resultado esperado: aparecen ambas claves (pueden ser `null` si la solicitud no tiene esos datos).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/financiero/facturas.py
git commit -m "feat(financiero): exponer aval_compra e items_cotizacion en detalle solicitud"
```

---

## Task 2: Frontend — tipos TypeScript

**Files:**
- Modify: `frontend/src/types/financiero.ts`

- [ ] **Step 1: Agregar interfaz `ItemCotizacion` y los campos a `SolicitudConFactura`**

Al inicio del archivo (antes de `export interface SolicitudConFactura`), agregar:

```typescript
export interface ItemCotizacion {
  num?: number | null
  descripcion?: string | null
  referencia?: string | null
  cantidad?: number | null
  valor_unitario?: number | null
  valor_total?: number | null
}
```

Luego, al final de la interfaz `SolicitudConFactura` (antes del cierre `}`), agregar:

```typescript
  /** Aval de compra de la solicitud (campo texto libre). */
  aval_compra_solicitud: string | null
  /** Ítems de la cotización aprobada. */
  items_cotizacion: ItemCotizacion[] | null
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores relacionados a `SolicitudConFactura`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/financiero.ts
git commit -m "feat(financiero): añadir ItemCotizacion e items/aval en tipo SolicitudConFactura"
```

---

## Task 3: Visor PDF autenticado — lógica de estado

**Files:**
- Modify: `frontend/src/pages/financiero/FacturaDetallePage.tsx`

Este paso solo agrega el estado y el `useEffect` para el blob URL del PDF. No cambia el JSX todavía.

- [ ] **Step 1: Agregar imports necesarios**

Al principio del archivo, `useEffect` ya está importado. Solo verificar que `useRef` también lo esté (ya está). No se necesita ningún import nuevo.

- [ ] **Step 2: Agregar estado del visor PDF**

Justo después de la línea `const [cuentaSeleccionada, setCuentaSeleccionada] = useState<number | null>(null)` (~línea 88), agregar:

```typescript
// Estado del visor PDF inline
const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
const [pdfLoading, setPdfLoading] = useState(false)
```

- [ ] **Step 3: Agregar `useEffect` que carga/revoca el blob URL**

Después del bloque de sincronización del formulario (después de `useAutosaveDraft` ~línea 142), agregar:

```typescript
// Cargar PDF como blob URL autenticado para el visor inline
useEffect(() => {
  if (!facturaId || !factura?.pdf_path) {
    setPdfBlobUrl(null)
    return
  }
  const esPdf = factura.pdf_path.toLowerCase().endsWith(".pdf")
  if (!esPdf) {
    setPdfBlobUrl(null)
    return
  }
  let objectUrl: string | null = null
  setPdfLoading(true)
  api
    .get(`/api/financiero/facturas/${facturaId}/pdf`, { responseType: "blob" })
    .then((resp) => {
      objectUrl = URL.createObjectURL(resp.data as Blob)
      setPdfBlobUrl(objectUrl)
    })
    .catch(() => setPdfBlobUrl(null))
    .finally(() => setPdfLoading(false))
  return () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    setPdfBlobUrl(null)
  }
}, [facturaId, factura?.pdf_path])
```

- [ ] **Step 4: Verificar que TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores nuevos.

---

## Task 4: Restructurar la sección "Factura del proveedor" — nueva sección comparativa

**Files:**
- Modify: `frontend/src/pages/financiero/FacturaDetallePage.tsx`

Esta es la tarea principal. Se reemplaza todo el bloque `{/* ── Sección B: Factura ──... */}` (líneas ~564–777) con el nuevo layout de 2 columnas. También se ajusta el bloque de `form` para simplificar a 3 campos.

- [ ] **Step 1: Actualizar el `useEffect` de sincronización del formulario para auto-rellenar fecha con hoy**

Ubicar el `useEffect` de sincronización del formulario (~línea 124). Cambiar:

```typescript
// ANTES
fecha_factura: factura.fecha_factura ?? "",
```

por:

```typescript
// DESPUÉS — si la factura no tiene fecha, pre-rellenar con hoy
fecha_factura: factura.fecha_factura ?? new Date().toISOString().split("T")[0],
```

El `useEffect` completo queda:

```typescript
useEffect(() => {
  if (factura && factura.id !== syncedFacturaId.current) {
    syncedFacturaId.current = factura.id
    setForm({
      numero_factura: factura.numero_factura ?? "",
      valor_factura: factura.valor_factura ?? undefined,
      fecha_factura: factura.fecha_factura ?? new Date().toISOString().split("T")[0],
    })
    setFormDirty(false)
  }
}, [factura])
```

> Nota: se eliminan del `setForm` los campos que ya no estarán en el formulario: `nit_proveedor`, `nombre_proveedor`, `fecha_recibida_factura`, `aval_compra`, `observaciones`.

- [ ] **Step 2: Reemplazar la sección "Factura del proveedor" completa**

Localizar el bloque desde `{/* ── Sección B: Factura ──────... */}` (~línea 564) hasta el cierre `</section>` (~línea 777) y reemplazarlo íntegramente con:

```tsx
{/* ── Nueva sección comparativa: OC + Formulario | Visor PDF ─── */}
<section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
  <div className="px-6 pt-5 pb-3 border-b border-gray-100">
    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
      Factura del proveedor
    </h2>
    <p className="text-xs text-gray-500 mt-0.5">
      Complete los tres campos y adjunte el archivo. La fecha se pre-rellena con el día de hoy.
    </p>
  </div>

  <div className="flex min-h-[600px]">
    {/* ── Columna izquierda ───────────────────────────────────── */}
    <div className="w-1/2 border-r border-gray-100 flex flex-col">

      {/* Cuadrante 1: Información de la OC */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Referencia OC
        </p>
        <div className="space-y-2">
          <OcRefField label="Aval de compra" value={solicitud.aval_compra_solicitud} />
          <OcRefField label="Valor aprobado" value={formatCOP(solicitud.valor_aprobado ?? null)} />
          <OcRefField
            label="Fecha en plataforma"
            value={
              solicitud.fecha_en_plataforma
                ? new Date(solicitud.fecha_en_plataforma).toLocaleDateString("es-CO")
                : null
            }
          />
          <OcRefField label="Proveedor" value={solicitud.proveedor_nombre} />
          {solicitud.proveedor_nit && (
            <OcRefField label="NIT proveedor" value={solicitud.proveedor_nit} />
          )}
        </div>

        {/* Ítems de la cotización aprobada */}
        {solicitud.items_cotizacion && solicitud.items_cotizacion.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Ítems cotizados
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {solicitud.items_cotizacion.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"
                >
                  <span className="font-medium">
                    {item.descripcion ?? `Ítem ${idx + 1}`}
                  </span>
                  {item.cantidad != null && (
                    <span className="ml-2 text-gray-500">× {item.cantidad}</span>
                  )}
                  {item.valor_total != null && (
                    <span className="ml-2 font-mono text-gray-600">
                      {formatCOP(item.valor_total)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cuadrante 2: Formulario de facturación */}
      <div className="p-5 flex-1 flex flex-col">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Datos de la factura
        </p>

        {!solicitud.factura_id && crearFacturaBorrador.isPending && (
          <div className="py-8 text-center text-sm text-gray-500">Preparando registro…</div>
        )}

        {!solicitud.factura_id && crearFacturaBorrador.isError && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            No se pudo iniciar el registro.{" "}
            <button
              type="button"
              className="underline font-medium"
              onClick={() => solicitudId && crearFacturaBorrador.mutate(solicitudId)}
            >
              Reintentar
            </button>
          </div>
        )}

        {factura && (
          <>
            {/* Los 3 campos editables */}
            <div className="space-y-3 mb-4">
              <FormField
                label="Número de factura"
                value={form.numero_factura ?? ""}
                onChange={(v) => handleChange("numero_factura", v)}
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-600">
                    Valor factura
                  </label>
                  {solicitud?.valor_aprobado != null && (
                    <button
                      type="button"
                      onClick={() => handleChange("valor_factura", solicitud.valor_aprobado!)}
                      className="text-xs text-brand-blue hover:underline"
                    >
                      Usar valor OC ({formatCOP(solicitud.valor_aprobado)})
                    </button>
                  )}
                </div>
                <FormFieldCOP
                  label=""
                  value={form.valor_factura}
                  onChange={(v) => handleChange("valor_factura", v ?? 0)}
                />
              </div>
              <FormFieldDate
                label="Fecha factura"
                value={form.fecha_factura ?? ""}
                onChange={(v) => handleChange("fecha_factura", v)}
              />
            </div>

            {/* Zona de carga del archivo */}
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-3 mb-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Archivo de factura</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleFileUpload(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                  dragOver
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-gray-200 hover:border-brand-blue/40 hover:bg-white"
                }`}
              >
                <p className="text-sm font-medium text-gray-700 text-center">
                  {subirFactura.isPending
                    ? "Subiendo…"
                    : factura.pdf_path
                      ? "Clic o arrastre para reemplazar"
                      : "Clic o arrastre para adjuntar"}
                </p>
                <p className="text-xs text-gray-400">PDF, Excel (.xlsx) o Word (.docx)</p>
                {subirFactura.isError && (
                  <p className="text-xs text-red-500">Error al subir. Intente de nuevo.</p>
                )}
                {factura.extraccion_automatica && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                    Número y valor prellenados desde archivo
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
              />
            </div>

            {/* Acciones */}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                onClick={handleEliminar}
                disabled={eliminarFactura.isPending}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                </svg>
                {eliminarFactura.isPending ? "Eliminando…" : "Eliminar"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleValidar}
                  disabled={validarFactura.isPending}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {validarFactura.isPending ? "Validando…" : "Correr validación"}
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={!formDirty || actualizarFactura.isPending}
                  className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
                >
                  {actualizarFactura.isPending ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>

    {/* ── Columna derecha: Visor PDF ────────────────────────────── */}
    <div className="w-1/2 flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Vista previa de la factura
        </p>
        {factura?.pdf_path && (
          <button
            type="button"
            onClick={() =>
              openAuthenticatedApiBlob(`/api/financiero/facturas/${facturaId}/pdf`)
            }
            className="text-xs text-brand-blue hover:underline flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
            </svg>
            Abrir en pestaña
          </button>
        )}
      </div>

      <div className="flex-1 relative">
        {/* Sin archivo */}
        {!factura?.pdf_path && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 4a2 2 0 0 1 2-2h6l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Z" />
            </svg>
            <p className="text-sm">Adjunte un archivo PDF para verlo aquí</p>
            <p className="text-xs mt-1">También admite Excel y Word (sin vista previa inline)</p>
          </div>
        )}

        {/* Archivo no-PDF */}
        {factura?.pdf_path && !factura.pdf_path.toLowerCase().endsWith(".pdf") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <p className="text-sm">Vista previa solo disponible para PDF.</p>
            <button
              type="button"
              onClick={() =>
                openAuthenticatedApiBlob(`/api/financiero/facturas/${facturaId}/pdf`)
              }
              className="mt-3 text-sm text-brand-blue hover:underline font-medium"
            >
              Descargar archivo adjunto
            </button>
          </div>
        )}

        {/* Cargando PDF */}
        {factura?.pdf_path?.toLowerCase().endsWith(".pdf") && pdfLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Cargando PDF…
          </div>
        )}

        {/* Visor iframe */}
        {pdfBlobUrl && (
          <iframe
            src={pdfBlobUrl}
            title="Vista previa factura"
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Agregar el sub-componente `OcRefField` al final del archivo**

Al final de `FacturaDetallePage.tsx`, después de `ConciliarFila` (~línea 1021), agregar:

```tsx
function OcRefField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? "—"}</span>
    </div>
  )
}
```

- [ ] **Step 4: Verificar que TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores en `FacturaDetallePage.tsx`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/financiero/FacturaDetallePage.tsx
git commit -m "feat(financiero): layout comparativo 2 columnas con visor PDF inline y formulario simplificado"
```

---

## Task 5: Limpiar referencias a campos eliminados del formulario

**Files:**
- Modify: `frontend/src/pages/financiero/FacturaDetallePage.tsx`

Los campos `nit_proveedor`, `nombre_proveedor`, `fecha_recibida_factura`, `aval_compra`, `observaciones` ya no están en el formulario. Hay partes del código que los usan y deben limpiarse.

- [ ] **Step 1: Limpiar `handleChange` y `handleGuardar`**

`handleChange` y `handleGuardar` no necesitan cambios — solo usan `form` genéricamente. Los campos removidos del formulario simplemente no se enviarán porque no estarán en `form` tras el `setForm` simplificado del Task 4 Step 1.

- [ ] **Step 2: Verificar que la sección "Conciliación OC vs Factura" sigue funcionando**

La sección `Conciliación` usa `form.nit_proveedor` y `form.nombre_proveedor`. Como estos ya no estarán en `form`, mostrarán `"—"`. Verificar que la sección sigue renderizando sin error de TypeScript.

Si hay error de TypeScript porque `form.nit_proveedor` no existe en el tipo `FacturaUpdate`, actualizar el tipo en `types/financiero.ts` para hacer esos campos opcionales (ya son `?`, no debería haber error).

Verificar:

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "financiero"
```

Resultado esperado: sin errores.

- [ ] **Step 3: Eliminar las imports no usadas**

Verificar si `useEliminarFactura`, `useValidarFactura`, `useActualizarFactura` siguen en uso (sí, los botones permanecen). Verificar que no haya variables declaradas y no usadas.

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "declared but"
```

Eliminar cualquier variable declarada y no usada que aparezca.

- [ ] **Step 4: Commit final**

```bash
git add frontend/src/pages/financiero/FacturaDetallePage.tsx \
        frontend/src/types/financiero.ts
git commit -m "fix(financiero): eliminar campos de factura no usados del formulario simplificado"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Info OC arriba izquierda: aval, valor, fecha, proveedor, ítems | Task 4 - Cuadrante 1 |
| Formulario abajo izquierda: número, valor, fecha auto | Task 4 - Cuadrante 2 |
| Motor de extracción sigue corriendo | No se cambia backend de extracción (OK) |
| Fecha auto-rellena con hoy | Task 4 Step 1 |
| Subir archivo con motor de extracción | Task 4 - Zona de carga |
| Visor PDF inline derecho | Task 3 + Task 4 |
| Solo 3 campos editables por usuario | Task 4 Steps 1-2 |

### Notas importantes

- El motor de extracción backend extrae NIT y nombre proveedor internamente para validación. Esto está bien — simplemente no se muestran en el formulario. La sección "Resultado de Validación" (que sigue en la página) seguirá funcionando.
- La sección "Conciliación OC vs Factura" existente permanece debajo de la nueva sección. En Fase 2 puede eliminarse dado que la nueva vista ya es comparativa.
- La sección "Bitácora" y "Cotizaciones" encima permanecen sin cambios.
- La sección "Cuentas Contables" debajo permanece sin cambios.
- El modal de borrador sigue funcionando pero con `form` simplificado.
