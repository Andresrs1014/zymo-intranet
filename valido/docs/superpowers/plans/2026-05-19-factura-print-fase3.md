# Factura — Fase 3: Generar PDF desde Vista Facturación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar el botón "Descargar formato" en `VistaFacturacionModal` para que genere un PDF con el mismo contenido del modal, usando `window.print()` desde una página de impresión dedicada.

**Architecture:** Nueva página `PrintFacturacionPage` en `/financiero/facturas/:solicitudId/print` que carga los mismos datos que el modal, los renderiza en formato optimizado para impresión, e invoca `window.print()` automáticamente al cargar. El botón del modal abre esta página en nueva pestaña. Cero dependencias nuevas.

**Tech Stack:** React 18, TypeScript, TailwindCSS, React Query, React Router v7

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `frontend/src/pages/financiero/PrintFacturacionPage.tsx` |
| Modificar | `frontend/src/App.tsx` |
| Modificar | `frontend/src/components/financiero/VistaFacturacionModal.tsx` |

---

## Task 1: Crear `PrintFacturacionPage.tsx`

**Files:**
- Create: `frontend/src/pages/financiero/PrintFacturacionPage.tsx`

- [ ] **Step 1: Crear el archivo completo**

Crear `frontend/src/pages/financiero/PrintFacturacionPage.tsx` con este contenido exacto:

```tsx
import { useEffect } from "react"
import { useParams } from "react-router-dom"
import {
  useSolicitudFinancieroDetalle,
  useFactura,
} from "@/hooks/useFinanciero"
import { formatCOP } from "@/lib/formatters"
import type { EstadoFactura } from "@/types/financiero"

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(v: string | null | undefined): string {
  if (!v) return "—"
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    return d.toLocaleDateString("es-CO", { dateStyle: "long" })
  } catch {
    return v
  }
}

function labelEstado(e: EstadoFactura | null | undefined): string {
  if (!e) return "—"
  const m: Record<EstadoFactura, string> = {
    pendiente: "Pendiente de validar",
    validada: "Validada",
    con_diferencias: "Con diferencias",
  }
  return m[e] ?? e
}

function PrintRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0 text-sm">
      <span className="w-52 shrink-0 text-gray-500 font-medium">{label}</span>
      <span className="text-gray-900 flex-1 break-words">{value ?? "—"}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 pb-1 border-b border-gray-200">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function PrintFacturacionPage() {
  const { solicitudId } = useParams<{ solicitudId: string }>()

  const { data: solicitud, isLoading } = useSolicitudFinancieroDetalle(solicitudId)
  const facturaId = solicitud?.factura_id ?? null
  const { data: factura, isLoading: loadingFactura } = useFactura(facturaId)

  // Auto-dispara impresión cuando los datos estén listos
  useEffect(() => {
    if (!solicitud) return
    if (facturaId && !factura) return // esperar la factura si existe
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [solicitud, factura, facturaId])

  if (isLoading || (facturaId && loadingFactura)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Preparando documento…
      </div>
    )
  }

  if (!solicitud) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-500">
        Solicitud no encontrada.
      </div>
    )
  }

  const numeroFactura = factura?.numero_factura ?? solicitud.numero_factura
  const valorFactura = factura?.valor_factura ?? solicitud.valor_factura
  const fechaFactura = factura?.fecha_factura ?? solicitud.fecha_factura
  const fechaRecibida = factura?.fecha_recibida_factura ?? null
  const avalCompra = factura?.aval_compra ?? null
  const estadoFactura = factura?.estado ?? solicitud.factura_estado
  const nitFactura = factura?.nit_proveedor ?? null
  const nombreFactura = factura?.nombre_proveedor ?? null

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 18mm 20mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media screen {
          body { background: #f3f4f6; }
        }
      `}</style>

      {/* Barra de acción (solo en pantalla, oculta al imprimir) */}
      <div className="no-print fixed top-0 inset-x-0 z-10 bg-white border-b border-gray-200 flex items-center justify-between px-6 py-3 shadow-sm">
        <span className="text-sm text-gray-600 font-medium">
          Vista previa — {solicitud.consecutivo_os ?? solicitudId}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105 transition-all"
        >
          Imprimir / Guardar como PDF
        </button>
      </div>

      {/* Contenido imprimible */}
      <div className="mx-auto max-w-3xl bg-white px-10 py-10 mt-16 print:mt-0 print:px-0 print:py-0 shadow-sm print:shadow-none min-h-screen">

        {/* Encabezado */}
        <div className="mb-8 pb-4 border-b-2 border-gray-900">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Resumen para facturación
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            {solicitud.consecutivo_os ?? "Solicitud"}
          </h1>
          {solicitud.descripcion && (
            <p className="text-sm text-gray-600 mt-1">{solicitud.descripcion}</p>
          )}
        </div>

        {/* Aprobación */}
        <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 mb-0.5">
            Quién aprobó la compra
          </p>
          <p className="text-base font-semibold text-emerald-950">
            {solicitud.aprobado_por_nombre?.trim() || "— (sin registro de aprobador)"}
          </p>
        </div>

        {/* Referencia OC */}
        <Section title="Referencia OC / Compra">
          <PrintRow label="Número OC" value={
            solicitud.numero_oc
              ? <span className="font-mono font-semibold">{solicitud.numero_oc}</span>
              : "—"
          } />
          <PrintRow label="Empresa (compra)" value={solicitud.empresa_compra_nombre ?? solicitud.plataforma} />
          <PrintRow label="Solicitante" value={solicitud.solicitante_nombre} />
          <PrintRow label="Área solicitante" value={solicitud.area_solicitante} />
          <PrintRow label="Condición comercial" value={solicitud.condicion} />
          <PrintRow label="Forma de pago (cotización)" value={solicitud.forma_pago} />
          <PrintRow label="Valor aprobado (OC)" value={formatCOP(solicitud.valor_aprobado)} />
          <PrintRow label="Valor sin IVA" value={formatCOP(solicitud.valor_antes_iva)} />
          <PrintRow label="IVA" value={formatCOP(solicitud.valor_iva)} />
        </Section>

        {/* Proveedor */}
        <Section title="Proveedor">
          <PrintRow label="Razón social (cotización)" value={solicitud.proveedor_nombre} />
          <PrintRow label="NIT (cotización / OC)" value={solicitud.proveedor_nit ?? null} />
          <PrintRow label="Razón social (factura)" value={nombreFactura} />
          <PrintRow label="NIT (factura)" value={nitFactura} />
        </Section>

        {/* Documento de factura */}
        <Section title="Documento de factura">
          <PrintRow
            label="Número de factura"
            value={
              numeroFactura
                ? <span className="font-mono font-semibold text-blue-700">{numeroFactura}</span>
                : "—"
            }
          />
          <PrintRow label="Fecha factura" value={formatFecha(fechaFactura)} />
          <PrintRow label="Valor factura" value={formatCOP(valorFactura)} />
          <PrintRow label="Fecha recibida en contabilidad" value={formatFecha(fechaRecibida)} />
          <PrintRow label="Aval de compra" value={avalCompra} />
          <PrintRow label="Estado validación" value={labelEstado(estadoFactura)} />
          {factura?.observaciones && String(factura.observaciones).trim() !== "" && (
            <PrintRow label="Observaciones" value={factura.observaciones} />
          )}
        </Section>

        {/* Pie */}
        <div className="mt-10 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
          <span>Generado desde ZYMO Intranet — Módulo Financiero</span>
          <span>{new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}</span>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/financiero/PrintFacturacionPage.tsx
git commit -m "feat(financiero): crear página de impresión PrintFacturacionPage para generar PDF"
```

---

## Task 2: Registrar ruta y habilitar botón en el modal

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/financiero/VistaFacturacionModal.tsx`

### Cambio en `App.tsx`

- [ ] **Step 1: Agregar import de `PrintFacturacionPage`**

En `App.tsx`, junto a los otros imports del módulo financiero (~líneas 38-41), agregar:

```typescript
import { PrintFacturacionPage } from "@/pages/financiero/PrintFacturacionPage"
```

- [ ] **Step 2: Registrar la ruta**

Después de la ruta `/financiero/facturas/:solicitudId` (que envuelve `FacturaDetallePage`), agregar la nueva ruta:

```tsx
<Route
  path="/financiero/facturas/:solicitudId/print"
  element={
    <FinancieroRoute>
      <PrintFacturacionPage />
    </FinancieroRoute>
  }
/>
```

### Cambio en `VistaFacturacionModal.tsx`

- [ ] **Step 3: Habilitar el botón "Descargar formato"**

Localizar la sección "Formato para facturación" (al final del contenido del modal, ~línea 166). Reemplazar el botón deshabilitado:

```tsx
// ANTES — botón deshabilitado
<button
  type="button"
  disabled
  className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed opacity-90"
  title="Próximamente"
>
  Descargar formato
</button>
```

por:

```tsx
// DESPUÉS — botón activo que abre la página de impresión
<button
  type="button"
  onClick={() =>
    window.open(
      `/financiero/facturas/${solicitud.solicitud_id}/print`,
      "_blank",
      "noopener,noreferrer"
    )
  }
  className="shrink-0 rounded-lg border border-brand-blue bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105 transition-all"
>
  Descargar / Imprimir
</button>
```

También actualizar el texto descriptivo justo encima del botón de:
```tsx
<p className="text-xs text-gray-500 mt-0.5 max-w-xl">
  Descarga de un documento con este mismo resumen (PDF u hoja de cálculo) estará disponible cuando se defina la plantilla.
</p>
```
a:
```tsx
<p className="text-xs text-gray-500 mt-0.5 max-w-xl">
  Abre una vista de impresión con este resumen. Desde el diálogo del navegador puedes guardar como PDF.
</p>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/financiero/VistaFacturacionModal.tsx
git commit -m "feat(financiero): habilitar botón Descargar formato con PrintFacturacionPage"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Mismo contenido que el modal | Task 1 — mismas 4 secciones y mismos campos |
| Genera PDF | Task 1 — auto-trigger `window.print()` |
| Botón "Descargar formato" funcional | Task 2 Step 3 |
| Cero dependencias nuevas | ✓ solo React/Router/ReactQuery ya instalados |
| Docker-ready | ✓ sin nuevas deps |

### Notas

- El 600ms de delay antes de `window.print()` le da tiempo al navegador a renderizar el documento completo antes de abrir el diálogo de impresión.
- `<style>` con `@media print` oculta la barra de acción al imprimir y configura márgenes A4.
- La ruta usa `FinancieroRoute` que garantiza autenticación — el token de Zustand persiste en la nueva pestaña (mismo origen, misma sesión del browser).
- Los helpers `formatFecha` y `labelEstado` son copias locales del modal para que la página sea autocontenida (no acoplamiento).
