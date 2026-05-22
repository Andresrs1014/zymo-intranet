# Actividades y Estados — Helix Zymo

> Este nodo explica qué significa cada estado operativamente y cuándo el agente debe preocuparse.
> Ver también: [[flujo_trabajo]] | [[alertas_y_notificaciones]] | [[reglas_de_negocio]]

---

## Los 5 estados y qué significan en la práctica

### Backlog
**Qué significa:** La actividad está identificada pero nadie la está trabajando todavía. Puede ser una idea, un pendiente futuro o algo que aún no tiene fecha ni responsable.

**Cuándo preocuparse:** Si una actividad de prioridad Alta lleva más de 3 días en Backlog sin moverse → señal de que nadie la tomó.

---

### Planificado
**Qué significa:** Ya tiene fecha, responsable y está comprometida para el sprint. El responsable sabe que le toca.

**Cuándo preocuparse:** Si la fecha de inicio ya pasó y sigue en Planificado → el responsable no arrancó. Alertar.

---

### En curso
**Qué significa:** El responsable está trabajando activamente en ella ahora mismo.

**Cuándo preocuparse:**
- Avance < 30% y falta menos de la mitad del tiempo → en riesgo
- Avance no cambió en 5+ días → posiblemente estancada o bloqueada
- Fecha fin ya pasó y sigue "En curso" → vencida, necesita atención

---

### Revision
**Qué significa:** El responsable terminó su parte y la está esperando que alguien la revise (normalmente Andrea o el gestor del proyecto).

**Cuándo preocuparse:** Si lleva más de 2 días en Revisión sin que nadie la cierre → el gestor no revisó. Puede estar acumulando un cuello de botella.

---

### Terminado
**Qué significa:** Cerrada, entregada, lista. El sistema registra automáticamente la fecha de cierre.

**El agente no genera alertas para actividades Terminadas** salvo que se pregunte por ellas.

---

## Indicadores de salud de una actividad

| Señal | Significado | Qué recomienda el agente |
|---|---|---|
| Vencida | fechaFin pasó y no está Terminada | Prioridad alta — mencionar primero |
| Bloqueada | Tiene impedimento activo | Escalar a Andrea o gestor |
| Avance < 50% con < 3 días | En riesgo de no llegar | Revisar con responsable |
| Sin avance > 5 días | Posiblemente abandonada | Preguntar al responsable qué pasó |
| En Revision > 2 días | Cuello de botella en revisión | Andrea debe revisar |

---

## Campos que importan para el agente

| Campo | Para qué lo usa el agente |
|---|---|
| `nombre` | Identificar la actividad en respuestas |
| `estado` | Saber en qué paso está |
| `responsableNombre` | Decir a quién le pertenece |
| `fechaFin` | Calcular retrasos y urgencias |
| `avance` | Evaluar si va bien o en riesgo |
| `bloqueada` | Alertar bloqueos activos |
| `prioridad` | Ordenar lo más urgente primero |
| `subproyectoNombre` | Contextualizar dentro del proyecto |

---

## Lo que el agente NO necesita para responder

- El `id` numérico (es para el sistema, no para Andrea)
- Los costos individuales por actividad (eso va en [[roi_y_valor]])
- Los `puntos` (story points) — solo sirven para estadísticas del equipo

---

*Última actualización: 2026-05-22 | Fuente: tablero Helix + `actividades_y_estados` del sistema*
