# Cierre Automático de Solicitud al Confirmar Recibo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando el solicitante confirma que recibió su pedido, la solicitud se cierra automáticamente (estado `cerrada`) sin pasar por el estado intermedio `entregada` ni requerir acción adicional del equipo de compras.

**Architecture:** Se modifica el endpoint `marcar-entregada` para saltar directamente a `cerrada`, seteando ambas fechas (`fecha_recibido` + `fecha_cerrado`) en una sola transacción. El frontend muestra un diálogo de confirmación advirtiendo que aceptar cierra la solicitud. El estado `entregada` se mantiene en el modelo para compatibilidad con solicitudes históricas que ya estén en ese estado.

**Tech Stack:** FastAPI (Python), React + TypeScript, React Query (TanStack Query), SQLModel

---

## Archivos modificados

| Archivo | Tipo | Qué cambia |
|---|---|---|
| `backend/app/routers/oc/documentos.py` | Modify | `marcar_entregada` va directo a `cerrada` con ambas fechas |
| `backend/app/routers/oc/solicitudes.py` | Modify | Mapa de transiciones: `oc_en_plataforma → {cerrada}` |
| `backend/app/agents/tools/oc_tools.py` | Modify | `_TIEMPO_LIMITE_HORAS` reemplaza etapa `entregada→cerrada` |
| `frontend/src/pages/operativo/MiSolicitudDetallePage.tsx` | Modify | Diálogo de confirmación + textos actualizados |
| `frontend/src/pages/oc/SolicitudDetallePage.tsx` | Modify | Panel `oc_en_plataforma` apunta directo a `cerrada`; panel `entregada` queda solo para legado |

---

## Task 1: Backend — `marcar_entregada` salta directo a `cerrada`

**Files:**
- Modify: `backend/app/routers/oc/documentos.py` (función `marcar_entregada`, ~línea 448)

- [ ] **Step 1: Reemplazar el cuerpo de `marcar_entregada`**

Busca la función `marcar_entregada` (empieza en `@router.post("/solicitudes/{solicitud_id}/marcar-entregada"`).

Reemplaza todo su cuerpo por este:

```python
@router.post(
    "/solicitudes/{solicitud_id}/marcar-entregada",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def marcar_entregada(
    solicitud_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    oc_db: Session = Depends(get_oc_db),
):
    from app.models.oc import EstadoOC
    from app.services import email_service

    es_compras = user_has_permission(db, current_user, "mod_oc_ver")

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    if not es_compras and solicitud.solicitante_email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el solicitante o el equipo de compras puede confirmar la recepción.",
        )
    if solicitud.estado != EstadoOC.oc_en_plataforma:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede confirmar recepción desde estado 'oc_en_plataforma'. Estado actual: {solicitud.estado}",
        )

    now = datetime.now(timezone.utc)
    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.cerrada
    solicitud.fecha_recibido = now
    solicitud.fecha_cerrado = now
    solicitud.updated_at = now
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.cerrada,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
    )
    oc_db.commit()
    oc_db.refresh(solicitud)
    background_tasks.add_task(email_service.send_entrega_confirmada, solicitud)
    return {"ok": True}
```

- [ ] **Step 2: Verificar que el servidor arranca sin errores**

```bash
cd /c/zymo-intranet
docker compose exec backend python -c "from app.routers.oc.documentos import marcar_entregada; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/oc/documentos.py
git commit -m "feat(oc): confirmar recibo cierra solicitud directamente sin paso entregada"
```

---

## Task 2: Backend — Actualizar mapa de transiciones de estado

**Files:**
- Modify: `backend/app/routers/oc/solicitudes.py` (dict `TRANSICIONES_VALIDAS`, ~línea 353)

- [ ] **Step 1: Localizar el dict de transiciones**

Busca el bloque que empieza con `TRANSICIONES_VALIDAS` o similar. Contiene líneas como:
```python
EstadoOC.oc_enviada:           {EstadoOC.oc_en_plataforma},
EstadoOC.oc_en_plataforma:     {EstadoOC.entregada},
EstadoOC.entregada:            {EstadoOC.cerrada},
```

- [ ] **Step 2: Cambiar la transición de `oc_en_plataforma`**

Reemplaza:
```python
EstadoOC.oc_en_plataforma:     {EstadoOC.entregada},
EstadoOC.entregada:            {EstadoOC.cerrada},
```

Por:
```python
EstadoOC.oc_en_plataforma:     {EstadoOC.cerrada},
EstadoOC.entregada:            {EstadoOC.cerrada},   # legado: solicitudes históricas
```

> **Nota:** Mantener `entregada → cerrada` permite que el equipo de compras pueda cerrar manualmente solicitudes que ya estaban en `entregada` antes de este cambio.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/oc/solicitudes.py
git commit -m "feat(oc): actualizar transiciones — oc_en_plataforma va directo a cerrada"
```

---

## Task 3: Backend — Actualizar tiempos límite en herramienta de KPIs

**Files:**
- Modify: `backend/app/agents/tools/oc_tools.py` (dict `_TIEMPO_LIMITE_HORAS`, ~línea 20)

- [ ] **Step 1: Actualizar el dict `_TIEMPO_LIMITE_HORAS`**

Busca:
```python
"oc_en_plataforma → entregada": 168,   # 7 días
"entregada → cerrada": 48,
```

Reemplaza por:
```python
"oc_en_plataforma → cerrada": 168,   # 7 días — el solicitante confirma y cierra
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/agents/tools/oc_tools.py
git commit -m "chore(oc): ajustar tiempo límite KPI — oc_en_plataforma va directo a cerrada"
```

---

## Task 4: Frontend — Diálogo de confirmación en vista del solicitante

**Files:**
- Modify: `frontend/src/pages/operativo/MiSolicitudDetallePage.tsx`

- [ ] **Step 1: Añadir estado local para el diálogo**

Después de la línea que declara `const [dragOver, setDragOver] = useState(false)`, añade:

```tsx
const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
```

- [ ] **Step 2: Actualizar los textos de `ESTADO_DESC`**

Reemplaza:
```tsx
entregada: "Confirmaste la recepción.",
cerrada: "Proceso completado.",
```

Por:
```tsx
entregada: "Confirmaste la recepción. La solicitud fue cerrada.",
cerrada: "Confirmaste la recepción. La solicitud está cerrada.",
```

- [ ] **Step 3: Reemplazar el bloque del botón "Confirmar recibo" por diálogo inline**

Busca el bloque (línea ~150):
```tsx
{esMia && solicitud.estado === "oc_en_plataforma" && (
  <div className="max-w-2xl mb-4 bg-green-50 rounded-xl border border-green-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <p className="text-sm font-semibold text-green-800 mb-0.5">¿Ya recibiste tu pedido?</p>
      <p className="text-sm text-green-700">
        Tu pedido está listo para ser retirado. Una vez que lo recibas, confírmalo aquí.
      </p>
    </div>
    <button
      onClick={() => marcarEntregada.mutate(id!)}
      disabled={marcarEntregada.isPending}
      className="shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
    >
      {marcarEntregada.isPending ? "Confirmando..." : "Confirmar recibo del pedido"}
    </button>
  </div>
)}
```

Reemplaza por:
```tsx
{esMia && solicitud.estado === "oc_en_plataforma" && (
  <div className="max-w-2xl mb-4 bg-green-50 rounded-xl border border-green-200 shadow-sm p-5 flex flex-col gap-4">
    <div>
      <p className="text-sm font-semibold text-green-800 mb-0.5">¿Ya recibiste tu pedido?</p>
      <p className="text-sm text-green-700">
        Tu pedido está listo para ser retirado. Confírmalo una vez que lo tengas en mano.
      </p>
    </div>

    {!mostrarConfirmacion ? (
      <button
        onClick={() => setMostrarConfirmacion(true)}
        className="self-start bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        Confirmar recibo del pedido
      </button>
    ) : (
      <div className="bg-white rounded-lg border border-green-300 p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-800">¿Confirmas que recibiste el pedido?</p>
        <p className="text-sm text-gray-600">
          Al aceptar, confirmas la recepción del producto y la solicitud quedará <strong>cerrada definitivamente</strong>. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              marcarEntregada.mutate(id!)
              setMostrarConfirmacion(false)
            }}
            disabled={marcarEntregada.isPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            {marcarEntregada.isPending ? "Confirmando..." : "Sí, recibí el pedido"}
          </button>
          <button
            onClick={() => setMostrarConfirmacion(false)}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Verificar que el componente compila sin errores TypeScript**

```bash
cd /c/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: Sin errores relacionados con `MiSolicitudDetallePage.tsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/operativo/MiSolicitudDetallePage.tsx
git commit -m "feat(oc): diálogo de confirmación al cerrar solicitud desde vista solicitante"
```

---

## Task 5: Frontend — Actualizar panel OC admin (`SolicitudDetallePage`)

**Files:**
- Modify: `frontend/src/pages/oc/SolicitudDetallePage.tsx`

El panel `oc_en_plataforma` en la vista del equipo de compras tiene un botón "Confirmar recepción" que llama al mismo endpoint. Ahora ese botón también cierra la solicitud directamente, así que solo hay que actualizar el texto del botón y el mensaje descriptivo.

- [ ] **Step 1: Actualizar texto del panel `oc_en_plataforma` en `FlowPanel`**

Busca (~línea 2574):
```tsx
<p className="text-xs text-violet-500 mt-0.5">Esperando confirmación del líder</p>
```

Reemplaza por:
```tsx
<p className="text-xs text-violet-500 mt-0.5">Esperando confirmación del solicitante — al confirmar se cierra la solicitud</p>
```

- [ ] **Step 2: Actualizar texto del botón "Confirmar recepción"**

Busca (~línea 2601):
```tsx
{isMarkingEntregada ? "Guardando..." : "Confirmar recepción"}
```

Reemplaza por:
```tsx
{isMarkingEntregada ? "Cerrando..." : "Confirmar recepción y cerrar"}
```

- [ ] **Step 3: Verificar que compila sin errores**

```bash
cd /c/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: Sin errores en `SolicitudDetallePage.tsx`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/oc/SolicitudDetallePage.tsx
git commit -m "feat(oc): actualizar textos panel OC — confirmar recepción cierra la solicitud"
```

---

## Task 6: Prueba manual end-to-end

- [ ] **Step 1: Levantar el entorno local**

```bash
cd /c/zymo-intranet
docker compose up -d
```

- [ ] **Step 2: Verificar flujo completo**

1. Con usuario auxiliar: llevar una solicitud hasta estado `oc_en_plataforma`
2. Con usuario solicitante: entrar a `/operativo/mis-solicitudes/:id`
3. Verificar que aparece el banner verde con el botón "Confirmar recibo del pedido"
4. Hacer clic → verificar que aparece el diálogo de confirmación con el mensaje de cierre
5. Hacer clic en "Sí, recibí el pedido"
6. Verificar que la solicitud cambia de estado a **`cerrada`** (no `entregada`)
7. Verificar que `fecha_recibido` y `fecha_cerrado` están ambas seteadas en la BD

- [ ] **Step 3: Verificar solicitudes históricas en `entregada`**

Si existe alguna solicitud en estado `entregada` (de antes del cambio), verificar que el equipo de compras aún puede cerrarla desde la vista OC con el botón "Cerrar solicitud".

- [ ] **Step 4: Verificar KPIs no están rotos**

```bash
curl -s http://localhost:8000/api/oc/kpis/tiempos | python -m json.tool | head -30
```

Expected: Respuesta JSON válida sin error 500.
