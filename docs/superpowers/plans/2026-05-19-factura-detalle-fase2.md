# Factura Detalle — Fase 2: Simplificación Motor de Validación y Limpieza de UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las secciones "Conciliación OC vs Factura" y "Resultado de Validación" del detalle de factura, quitar el botón "Correr validación", y simplificar el motor de validación del backend para que solo valide los 3 campos que llena contabilidad (número, valor y fecha).

**Architecture:** Dos cambios independientes — backend simplifica `_ejecutar_validacion` quitando NIT y nombre proveedor y agregando checks de presencia para número y fecha; frontend elimina las secciones de UI y limpia todo el código muerto asociado (imports, variables, helpers, sub-componente `ConciliarFila`).

**Tech Stack:** FastAPI + SQLModel (Python), React 18, TypeScript, TailwindCSS

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `backend/app/routers/financiero/facturas.py` |
| Modificar | `frontend/src/pages/financiero/FacturaDetallePage.tsx` |

---

## Task 1: Backend — simplificar `_ejecutar_validacion` a 3 campos

**Files:**
- Modify: `backend/app/routers/financiero/facturas.py` (función `_ejecutar_validacion`, ~líneas 1094-1225)

### Contexto

La función `_ejecutar_validacion` actualmente valida 3 campos: `valor`, `nit_proveedor`, `nombre_proveedor`.

Debe quedar con solo 3 checks correspondientes a los campos que llena contabilidad:
1. `numero_factura` — presencia (no vacío)
2. `valor` — comparación vs `cotizacion.valor_aprobado` con tolerancia 1% (lógica existente, sin cambios)
3. `fecha_factura` — presencia (no nulo)

Los checks de `nit_proveedor` y `nombre_proveedor` se eliminan completamente.

- [ ] **Step 1: Reemplazar el cuerpo de `_ejecutar_validacion`**

Localizar la función `_ejecutar_validacion` (~línea 1094) y reemplazar **todo su cuerpo** (desde `if cotizacion.id != orden.cotizacion_id:` hasta `fin_db.commit()`) con:

```python
    if cotizacion.id != orden.cotizacion_id:
        log.warning(
            "[validación] cotización %s no coincide con orden.cotizacion_id %s — usando datos de la orden",
            cotizacion.id,
            orden.cotizacion_id,
        )
    now = datetime.now(timezone.utc)
    checks: list[tuple[str, Optional[str], Optional[str], bool, Optional[str]]] = []

    # 1. Número de factura — verificar presencia
    num = factura.numero_factura
    cumple_numero = bool(num and num.strip())
    checks.append((
        "numero_factura",
        "Campo requerido",
        num if num else None,
        cumple_numero,
        None if cumple_numero else "Número de factura no diligenciado",
    ))

    # 2. Valor — comparar contra valor aprobado de la OC (tolerancia configurable)
    val_esperado = cotizacion.valor_aprobado
    val_encontrado = factura.valor_factura
    if val_esperado is not None and val_encontrado is not None:
        diferencia_pct = abs(val_encontrado - val_esperado) / max(val_esperado, 1) * 100
        cumple_valor = diferencia_pct <= TOLERANCIA_VALOR_PCT
        obs_valor = (
            None if cumple_valor
            else f"Diferencia de {diferencia_pct:.2f}% (tolerancia {TOLERANCIA_VALOR_PCT}%)"
        )
    elif val_esperado is None:
        cumple_valor = False
        obs_valor = "La OC no registra valor aprobado para comparar"
    else:
        cumple_valor = False
        obs_valor = "Indique el valor en el formulario de factura para comparar con la OC"
    checks.append((
        "valor",
        _fmt_cop(val_esperado),
        _fmt_cop(val_encontrado),
        cumple_valor,
        obs_valor,
    ))

    # 3. Fecha de factura — verificar presencia
    fecha = factura.fecha_factura
    cumple_fecha = fecha is not None
    checks.append((
        "fecha_factura",
        "Campo requerido",
        str(fecha) if fecha else None,
        cumple_fecha,
        None if cumple_fecha else "Fecha de factura no diligenciada",
    ))

    # Upsert validaciones
    for campo, esperado, encontrado, cumple, obs in checks:
        existente = fin_db.exec(
            select(ValidacionFactura).where(
                ValidacionFactura.factura_id == factura.id,
                ValidacionFactura.campo == campo,
            )
        ).first()
        if existente:
            existente.valor_esperado = esperado
            existente.valor_encontrado = encontrado
            existente.cumple = cumple
            existente.observacion = obs
            existente.created_at = now
            fin_db.add(existente)
        else:
            fin_db.add(ValidacionFactura(
                factura_id=factura.id,
                campo=campo,
                valor_esperado=esperado,
                valor_encontrado=encontrado,
                cumple=cumple,
                observacion=obs,
                created_at=now,
            ))

    # Actualizar estado de la factura
    all_pass = all(cumple for _, _, _, cumple, _ in checks)
    factura.estado = EstadoFactura.validada if all_pass else EstadoFactura.con_diferencias
    factura.updated_at = now
    fin_db.add(factura)
    fin_db.commit()
```

> Nota: La función `_normalizar_nit` que estaba definida dentro de `_ejecutar_validacion` también desaparece al reemplazar el cuerpo. No se usa en ningún otro lugar.

- [ ] **Step 2: Verificar que no quedan referencias a `_normalizar_nit` ni a los campos eliminados**

```bash
cd C:/zymo-intranet/backend && grep -n "_normalizar_nit\|nit_proveedor.*check\|nombre_proveedor.*check" app/routers/financiero/facturas.py
```

Resultado esperado: sin resultados (0 líneas).

- [ ] **Step 3: Verificar que el módulo importa correctamente**

```bash
cd C:/zymo-intranet/backend && python -c "from app.routers.financiero.facturas import router; print('OK')" 2>&1
```

Resultado esperado: `OK` (el error de secret_key en entorno local es normal y no indica fallo de importación de módulo).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/financiero/facturas.py
git commit -m "feat(financiero): simplificar validación a 3 campos — número, valor, fecha"
```

---

## Task 2: Frontend — eliminar secciones de UI y código muerto

**Files:**
- Modify: `frontend/src/pages/financiero/FacturaDetallePage.tsx`

### Contexto

Elementos a eliminar del archivo (en orden):

**Helpers al principio del archivo:**
- `CAMPO_LABELS` (objeto Record, ~línea 30-35)
- `labelValidacionCampo` (función, ~línea 36-38) — solo usada en la sección de validación

**Imports no usados:**
- `useValidaciones` (~línea 8)
- `useValidarFactura` (~línea 11)

**Variables y funciones en el componente:**
- `const { data: validaciones = [] } = useValidaciones(facturaId)` (~línea 76)
- `const validarFactura = useValidarFactura()` (~línea 80)
- `const cotizacionAprobada = ...` (~línea 65) — solo usada en Conciliación
- `function handleValidar()` (~línea 216-219)

**Secciones JSX:**
- Sección "Conciliación OC vs Factura" completa (~líneas 551-600)
- Botón "Correr validación" dentro del form (~líneas 784-792)
- Sección "Resultado de Validación" completa (~líneas 873-950)

**Sub-componente al final del archivo:**
- `ConciliarFila` (~línea 1083 en adelante)

### Pasos

- [ ] **Step 1: Eliminar `CAMPO_LABELS` y `labelValidacionCampo`**

Localizar y eliminar este bloque (~líneas 30-38):

```typescript
const CAMPO_LABELS: Record<string, string> = {
  valor: "Valor total",
  nit_proveedor: "NIT proveedor",
  nombre_proveedor: "Razón social / nombre proveedor",
}

function labelValidacionCampo(campo: string): string {
  return CAMPO_LABELS[campo] ?? campo
}
```

- [ ] **Step 2: Eliminar imports `useValidaciones` y `useValidarFactura`**

En el bloque de imports de `useFinanciero`, eliminar las dos líneas:

```typescript
  useValidaciones,
```
```typescript
  useValidarFactura,
```

- [ ] **Step 3: Eliminar variables del cuerpo del componente**

Eliminar estas líneas del cuerpo del componente `FacturaDetallePage`:

```typescript
const { data: validaciones = [] } = useValidaciones(facturaId)
```

```typescript
const validarFactura = useValidarFactura()
```

```typescript
const cotizacionAprobada = cotizacionesLista.find((c) => c.aprobada === true) ?? null
```

```typescript
function handleValidar() {
  if (!facturaId) return
  validarFactura.mutate(facturaId)
}
```

- [ ] **Step 4: Eliminar la sección "Conciliación OC vs Factura"**

Localizar el bloque que empieza con:
```
{/* ── Sección: Conciliación OC vs Factura ──────────────────── */}
{factura && (
  <section className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
```

y termina con:
```
  </section>
)}
```

Eliminar **todo el bloque** (desde el comentario hasta el `)}` inclusive).

- [ ] **Step 5: Eliminar el botón "Correr validación" del form**

Dentro de la sección de acciones del formulario simplificado, localizar y eliminar solo este botón:

```tsx
<button
  type="button"
  onClick={handleValidar}
  disabled={validarFactura.isPending}
  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
>
  {validarFactura.isPending ? "Validando…" : "Correr validación"}
</button>
```

El `<div className="flex gap-2">` que lo contiene junto con el botón "Guardar cambios" debe quedar así (solo con el botón de guardar):

```tsx
<div className="flex gap-2">
  <button
    onClick={handleGuardar}
    disabled={!formDirty || actualizarFactura.isPending}
    className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-50 transition-all"
  >
    {actualizarFactura.isPending ? "Guardando…" : "Guardar cambios"}
  </button>
</div>
```

- [ ] **Step 6: Eliminar la sección "Resultado de Validación" completa**

Localizar el bloque que empieza con:
```
{/* ── Sección C: Resultado de Validación ────────────────────── */}
{factura && (
  <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
        Resultado de Validación
```

y termina con su `</section>` y `)}`.

Eliminar **todo el bloque** incluyendo el comentario inicial.

- [ ] **Step 7: Eliminar el sub-componente `ConciliarFila`**

Al final del archivo, eliminar la función completa:

```tsx
function ConciliarFila({
  label,
  oc,
  factura,
  igual,
}: {
  label: string
  oc: string
  factura: string
  igual?: boolean
}) {
  const coincide = igual !== undefined
    ? igual
    : oc !== "—" && factura !== "—" && oc.trim().toLowerCase() === factura.trim().toLowerCase()
  const sinDatos = oc === "—" || factura === "—"

  return (
    <tr>
      <td className="py-2.5 pr-4 text-xs font-medium text-gray-500">{label}</td>
      <td className="py-2.5 pr-4 text-gray-700 text-sm">{oc}</td>
      <td className="py-2.5 text-sm">
        <span className={!sinDatos && !coincide ? "text-red-600 font-medium" : "text-gray-700"}>
          {factura}
        </span>
        {!sinDatos && (
          coincide
            ? <span className="ml-2 text-green-500 text-xs font-bold" title="Coincide">✓</span>
            : <span className="ml-2 text-red-400 text-xs font-bold" title="Difiere">✗</span>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 8: Verificar que TypeScript compila sin errores**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores.

- [ ] **Step 9: Verificar que las secciones eliminadas no aparecen en el archivo**

```bash
grep -n "Conciliación\|Resultado de Validación\|Correr validación\|ConciliarFila\|labelValidacionCampo\|CAMPO_LABELS\|handleValidar\|validarFactura\|useValidaciones\|useValidarFactura\|cotizacionAprobada" C:/zymo-intranet/frontend/src/pages/financiero/FacturaDetallePage.tsx
```

Resultado esperado: 0 líneas.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/financiero/FacturaDetallePage.tsx
git commit -m "feat(financiero): eliminar Conciliación, Resultado Validación y código muerto de fase 2"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Quitar sección "Conciliación OC vs Factura" | Task 2 Step 4 |
| Quitar sección "Resultado de Validación" | Task 2 Step 6 |
| Quitar botón "Correr validación" | Task 2 Step 5 |
| Motor de extracción queda solo en 3 campos de contabilidad | Task 1 (backend valida número, valor, fecha) |
| Limpiar código muerto asociado | Task 2 Steps 1-3, 7 |

### Notas

- `FacturaEstadoBadge` se conserva — sigue siendo usado en el header de la página (línea ~351) para mostrar estado de la factura.
- `useCotizacionesFinanciero` y `cotizacionesLista` se conservan — siguen siendo usados en la sección "Cotizaciones del proceso".
- El endpoint backend `POST /facturas/{factura_id}/validar` permanece funcional (simplificado). No hay consumidores del lado UI que lo llamen pero puede usarse en el futuro o via admin.
- El estado de factura (`pendiente`/`validada`/`con_diferencias`) se actualiza solo cuando se llame la validación (desde backend/admin). Para nuevas facturas el estado queda en `pendiente` hasta que se valide externamente.
