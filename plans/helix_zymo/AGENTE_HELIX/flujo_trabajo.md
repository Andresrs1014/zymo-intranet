# Flujo de Trabajo — Helix Zymo

> Fuente directa: `frontend/src/components/planeacion/helix/board/BoardView.tsx` + `helix-backend/src/routers/actividades.ts`
> Ver también: [[actividades_y_estados]] | [[subproyectos]] | [[reglas_de_negocio]]

---

## Flujo completo de una actividad

```
[GESTOR crea subproyecto]
        ↓
[GESTOR/EQUIPO crea actividad en Backlog]
        ↓
[GESTOR planifica → mueve a Planificado + asigna responsable + fechas]
        ↓
[RESPONSABLE inicia trabajo → mueve a En curso]
        ↓
[RESPONSABLE actualiza avance % periódicamente]
        ↓
[RESPONSABLE termina → mueve a Revision]
        ↓
[GESTOR revisa → mueve a Terminado]
        ↓
[Sistema registra completadaEn, suma puntos al responsable]
```

---

## Paso 1 — Creación del subproyecto

**Quién:** Gestor (usuario con acceso al módulo Helix)
**Dónde:** Vista Config → pestaña Subproyectos
**Endpoint:** `POST /api/subproyectos`
**Campos obligatorios:** `nombre`
**Campos opcionales:** `objetivo`, `cliente`, `inversionEst` (presupuesto), `retornoEsp` (retorno esperado)

---

## Paso 2 — Creación de actividad

**Quién:** Gestor o miembro del equipo
**Dónde:** Botón "Nueva actividad" en el Tablero Scrum → abre TaskDialog
**Endpoint:** `POST /api/actividades`
**Estado inicial:** `Backlog` (siempre)
**Campos obligatorios:** `nombre`, `subproyectoId`, `responsableId`, `fechaInicio`, `fechaFin`

---

## Paso 3 — Planificación (Backlog → Planificado)

**Quién:** Gestor
**Cómo:** Drag & drop de la tarjeta a la columna "Planificado" en el Tablero Scrum, o editar y cambiar estado
**Endpoint:** `PATCH /api/actividades/:id/estado` con `{ estado: "Planificado" }`
**Qué implica:** La actividad ya tiene fecha, responsable y está comprometida para el sprint

---

## Paso 4 — Inicio de ejecución (Planificado → En curso)

**Quién:** Responsable o gestor
**Cómo:** Drag & drop a columna "En curso"
**Qué implica:** El responsable está trabajando activamente en la actividad

---

## Paso 5 — Actualización de avance

**Quién:** Responsable
**Cómo:** Editar actividad (botón lápiz en tarjeta) → campo Avance 0-100%
**Endpoint:** `PATCH /api/actividades/:id/avance` o `PUT /api/actividades/:id`
**Frecuencia recomendada:** Al menos 2 veces por semana

---

## Paso 6 — Revisión (En curso → Revision)

**Quién:** Responsable
**Cómo:** Drag & drop a columna "Revision"
**Qué implica:** El trabajo está listo para ser verificado por el gestor

---

## Paso 7 — Cierre (Revision → Terminado)

**Quién:** Gestor
**Cómo:** Drag & drop a columna "Terminado"
**Endpoint:** `PATCH /api/actividades/:id/estado` con `{ estado: "Terminado" }`
**Qué implica:** La actividad cierra, se registra `completadaEn`, los puntos se suman al responsable

---

## Flujo de bloqueo (paralelo)

En cualquier momento un gestor puede marcar `bloqueada: true` via la edición de la actividad:
```
Actividad en cualquier estado → bloqueada: true
↓
Aparece con borde rojo en tablero
↓
Alerta automática si lleva +2 días bloqueada
↓
Gestor resuelve bloqueo → bloqueada: false
```

---

## Vista del Tablero Scrum

El tablero muestra las 5 columnas de estados con drag & drop real (`@dnd-kit/core`).
Las tarjetas muestran: nombre, responsable (avatar), prioridad (chip), avance (barra), fecha de entrega.

---

*Última actualización: 2026-05-22 | Fuente: `BoardView.tsx` + `actividades.ts` router*
