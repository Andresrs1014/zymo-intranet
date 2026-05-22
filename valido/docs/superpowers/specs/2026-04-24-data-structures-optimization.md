# Optimización de Estructuras de Datos — zymo-intranet
**Fecha:** 2026-04-24
**Alcance:** Optimizaciones quirúrgicas — sin cambio de arquitectura, sin librerías nuevas
**Contexto:** Análisis de todo el codebase. No se requieren estructuras avanzadas (grafos, árboles, heaps). Los problemas son de eficiencia SQL y patrones de consulta.

---

## Veredicto: ¿Se Necesitan Estructuras Avanzadas?

| Estructura | Decisión | Razón |
|-----------|----------|-------|
| Grafo (networkx) | ❌ No necesario | La máquina de estados ya usa `dict[EstadoOC, set[EstadoOC]]` con lookup O(1). 11 nodos. Agregar networkx añade dependencia sin beneficio. |
| Árbol / BTree | ❌ No necesario | El historial temporal se resuelve precargando en dict en memoria — mismo resultado. |
| Heap / Priority Queue | ❌ No necesario | Las alertas por prioridad se resuelven con ORDER BY en SQL. |
| Trie | ❌ No necesario | Pocos usuarios, índice de email en BD es suficiente. |
| Redis cache | ⚠️ Opcional | Útil para /kpis pero con las optimizaciones SQL el impacto es menor. No se incluye en este plan — se puede agregar en el futuro si el volumen de datos crece. |

**Conclusión:** Las estructuras existentes (Dict, Set, Enum) son correctas para el escala del proyecto. Los problemas son de eficiencia SQL y patrones de consulta, no de estructura de datos.

---

## Qué Está Bien (No Tocar)

- ✅ `EstadoOC` como `str(Enum)` — typesafe, evita typos
- ✅ `_TRANSICIONES: dict[EstadoOC, set[EstadoOC]]` — O(1) lookup para validar transiciones
- ✅ Sets de roles en `deps.py` y `permissions.ts` — O(1) verificación de permisos
- ✅ FK + índices en PKs de todas las tablas
- ✅ JSON fields para `items` en cotizaciones y paquetes — flexibilidad sin tablas extra
- ✅ `agent_memory` indexada por `user_email`

---

## Problemas Identificados

### Problema 1 — Índices faltantes en `oc_historial_estados` (CRÍTICO)

**Impacto:** Cada reporte de KPIs de reprocesos hace full table scan sobre toda la tabla de historial.

**Consultas afectadas:**
```python
# Trae TODOS los reprocesos sin índice → full table scan
reprocesos_entradas = oc_db.exec(
    select(HistorialEstado).where(HistorialEstado.es_reproceso == True)
).all()

# Trae por tipo_accion sin índice → full table scan
rechazos_solicitud = oc_db.exec(
    select(func.count(HistorialEstado.id))
    .where(HistorialEstado.tipo_accion == "cancelacion_solicitud")
).one()
```

**Índices que faltan:**
- `(es_reproceso, fecha DESC)` — para queries de reprocesos ordenadas
- `(tipo_accion)` — para counts por tipo de acción
- `(solicitud_id, fecha ASC)` — para timeline ordenado de una solicitud (ya existe índice en solicitud_id pero no compuesto con fecha)

---

### Problema 2 — KPI endpoint: 15+ queries individuales (ALTO)

**Impacto:** El endpoint `/kpis` hace 10+ queries separadas por estado, cada una un roundtrip a la BD.

**Código actual (problema):**
```python
# 10 queries — una por estado
for estado in EstadoOC:
    count = oc_db.exec(
        select(func.count(SolicitudOC.id))
        .where(SolicitudOC.estado == estado)
    ).one()
    por_estado.append(ConteoItem(label=estado.value, valor=count))
```

**Solución — 1 query con GROUP BY:**
```python
# 1 query
resultados = oc_db.exec(
    select(SolicitudOC.estado, func.count(SolicitudOC.id).label("cnt"))
    .group_by(SolicitudOC.estado)
).all()
por_estado = [ConteoItem(label=r.estado, valor=r.cnt) for r in resultados]
```

---

### Problema 3 — Búsqueda de "siguiente entrada" genera N queries (ALTO)

**Impacto:** Para calcular tiempos de reproceso, por cada entrada de reproceso se hace una query adicional a la BD para encontrar la siguiente entrada.

**Código actual (problema):**
```python
for entrada in reprocesos_entradas:
    # Una query por cada reproceso → N queries
    siguiente = oc_db.exec(
        select(HistorialEstado)
        .where(
            HistorialEstado.solicitud_id == entrada.solicitud_id,
            HistorialEstado.fecha > entrada.fecha,
            HistorialEstado.es_reproceso == False,
        )
        .order_by(HistorialEstado.fecha)
        .limit(1)
    ).first()
```

**Solución — precargar historial en dict, buscar en memoria:**
```python
# 1 query para traer todo el historial relevante
solicitud_ids = {e.solicitud_id for e in reprocesos_entradas}
historiales = oc_db.exec(
    select(HistorialEstado)
    .where(HistorialEstado.solicitud_id.in_(solicitud_ids))
    .order_by(HistorialEstado.solicitud_id, HistorialEstado.fecha.asc())
).all()

# Indexar en dict — O(n) una sola vez
historial_por_solicitud: dict[str, list[HistorialEstado]] = {}
for h in historiales:
    historial_por_solicitud.setdefault(str(h.solicitud_id), []).append(h)

# Buscar siguiente en memoria — O(n) por solicitud, sin roundtrip BD
for entrada in reprocesos_entradas:
    entradas_solicitud = historial_por_solicitud.get(str(entrada.solicitud_id), [])
    siguiente = next(
        (e for e in entradas_solicitud
         if e.fecha > entrada.fecha and not e.es_reproceso),
        None
    )
```

**Ganancia:** N queries → 1 query + búsqueda en memoria

---

### Problema 4 — Cálculo de promedios de tiempo en Python (MEDIO)

**Impacto:** Se traen todos los registros con fecha a Python y se calcula el promedio con un loop. La BD podría hacer esto directamente.

**Código actual (problema):**
```python
solicitudes_con_fecha = oc_db.exec(
    select(SolicitudOC).where(SolicitudOC.fecha_cotizacion != None)
).all()
tiempos = []
for s in solicitudes_con_fecha:
    delta = (s.fecha_cotizacion - s.fecha_solicitud).total_seconds() / 3600
    tiempos.append(delta)
promedio = sum(tiempos) / len(tiempos) if tiempos else 0
```

**Solución — AVG en SQL:**
```python
promedio = oc_db.exec(
    select(func.avg(
        func.julianday(SolicitudOC.fecha_cotizacion) -
        func.julianday(SolicitudOC.fecha_solicitud)
    ) * 24)  # horas
    .where(SolicitudOC.fecha_cotizacion != None)
).one()
```

> Nota: SQLite usa `julianday()` en lugar de `DATEDIFF()`. La multiplicación × 24 convierte días a horas.

---

## Plan de Implementación

### Fase 1 — Índices SQL (sin riesgo, sin cambio de código)

**Archivo:** `backend/app/oc_database.py` — agregar en los modelos SQLModel los índices faltantes

```python
class HistorialEstado(SQLModel, table=True):
    __tablename__ = "oc_historial_estados"
    __table_args__ = (
        # Índice existente (solo solicitud_id)
        # Nuevos índices:
        Index("ix_historial_es_reproceso", "es_reproceso", "fecha"),
        Index("ix_historial_tipo_accion", "tipo_accion"),
        Index("ix_historial_solicitud_fecha", "solicitud_id", "fecha"),
    )
```

**Alternativa directa en SQLite** (si se prefiere sin tocar modelos):
```sql
CREATE INDEX IF NOT EXISTS ix_historial_es_reproceso
    ON oc_historial_estados(es_reproceso, fecha DESC);

CREATE INDEX IF NOT EXISTS ix_historial_tipo_accion
    ON oc_historial_estados(tipo_accion);

CREATE INDEX IF NOT EXISTS ix_historial_solicitud_fecha
    ON oc_historial_estados(solicitud_id, fecha ASC);
```

**Cómo aplicar en producción sin downtime:**
```bash
# Los índices en SQLite se crean sin bloquear lecturas
sqlite3 /app/data/oc.db < add_indexes.sql
```

---

### Fase 2 — Refactor KPI: por_estado (10 queries → 1)

**Archivo:** `backend/app/routers/oc/kpis.py`

Reemplazar el loop de 10 queries individuales por estado por una sola query GROUP BY.

**Cambio quirúrgico** — solo la sección `por_estado`, nada más del endpoint.

---

### Fase 3 — Refactor KPI: precargar historial para reprocesos (N queries → 1)

**Archivo:** `backend/app/routers/oc/kpis.py`

Reemplazar la búsqueda secuencial de "siguiente entrada" por el patrón de precargar todo el historial relevante en un dict y buscar en memoria.

---

### Fase 4 — Refactor KPI: AVG en SQL para promedios de tiempo (opcional)

**Archivo:** `backend/app/routers/oc/kpis.py`

Reemplazar loops de cálculo de promedio de tiempos por `func.avg(func.julianday(...))` en SQL.

> Esta fase es la de menor impacto relativo — la Fase 1 y 2 son las que más reducen carga. Implementar solo si el endpoint /kpis sigue lento después de Fase 1+2+3.

---

## Impacto Esperado

| Optimización | Antes | Después | Ganancia |
|-------------|-------|---------|---------|
| Índices en HistorialEstado (Fase 1) | Full table scan ~100ms | Index scan ~5ms | ~20x más rápido |
| por_estado GROUP BY (Fase 2) | 10 roundtrips BD | 1 roundtrip | ~500ms → 50ms |
| Precargar historial reprocesos (Fase 3) | N queries (N = # reprocesos) | 1 query + memoria | Lineal → constante |
| AVG en SQL (Fase 4) | Loop Python en todos los registros | 1 query SQL | Reducción transferencia datos |

**Total estimado `/kpis` endpoint:**
- Antes: 500ms - 1500ms (dependiendo de volumen de datos)
- Después Fase 1+2+3: 50ms - 150ms

---

## Archivos a Modificar

| Archivo | Cambio | Riesgo |
|---------|--------|--------|
| `backend/app/oc_database.py` | Agregar `__table_args__` con Index en HistorialEstado | Bajo — solo agrega índices |
| `backend/app/routers/oc/kpis.py` | 3 refactors puntuales (por_estado, reprocesos, promedios) | Bajo — mismos resultados, distinta query |
| `oc.db` (producción) | `CREATE INDEX` directo en SQLite | Muy bajo — no bloquea lecturas |

**Lo que NO se toca:**
- Modelos de datos (misma estructura de tablas)
- Endpoints existentes (misma firma, mismos campos de respuesta)
- Frontend (ningún cambio)
- Agentes Python (ningún cambio)
- Lógica de negocio (ningún cambio)

---

## Orden de Implementación

```
1. Crear los 3 índices en oc.db (producción) — sin downtime, sin reinicio
2. Refactor por_estado en kpis.py — 1 query GROUP BY
3. Refactor búsqueda de "siguiente entrada" — dict en memoria
4. (Opcional) Refactor AVG de tiempos — julianday en SQL
5. Probar /kpis en producción — comparar tiempos de respuesta
```

---

## Por Qué No Se Necesitan Estructuras Avanzadas

### La máquina de estados ya es óptima

```python
_TRANSICIONES: dict[EstadoOC, set[EstadoOC]] = {
    EstadoOC.nueva: {EstadoOC.en_cotizacion, EstadoOC.cancelada},
    ...
}
```

Esto ya es un grafo dirigido representado como lista de adyacencia. Para 11 nodos y ~20 aristas, cualquier librería de grafos (networkx, etc.) haría exactamente lo mismo internamente. Agregar networkx solo añade 4MB de dependencia sin cambio de comportamiento.

### El sistema de permisos ya es óptimo

```python
OC_ROLES = {"admin", "administrativo", "directivo", "compras"}
# Lookup O(1) — ya es la estructura más eficiente posible
if current_user.role in OC_ROLES: ...
```

Un árbol de permisos o sistema más complejo solo agregaría overhead para el mismo resultado.

### El historial de estados es una lista temporal, no un grafo

El historial se consulta casi siempre en orden cronológico para una solicitud específica. La estructura correcta es lista ordenada + índice por `(solicitud_id, fecha)` — exactamente lo que hacemos con los índices de Fase 1.

---

*Versión: 1.0 | Fecha: 2026-04-24 | Conclusión: Optimizaciones SQL puntuales, sin cambio de arquitectura*
