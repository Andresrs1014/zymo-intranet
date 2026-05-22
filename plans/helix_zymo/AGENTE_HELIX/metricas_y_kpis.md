# Métricas y KPIs — Helix Zymo

> Este nodo explica qué números mirar, qué significan y cuándo son señal de problema.
> El agente usa estos indicadores para responder preguntas de estado y generar alertas.
> Ver también: [[alertas_y_notificaciones]] | [[roi_y_valor]] | [[preguntas_frecuentes_andrea]]

---

## Resumen de métricas que el agente monitorea

### KPI-01: Avance global del equipo
**Qué es:** Promedio del % de avance de todas las actividades activas
**Qué le dice a Andrea:**
- > 70% → el equipo va bien
- 40–70% → ritmo normal, vigilar las vencidas
- < 40% → el equipo va lento o hay muchas actividades nuevas sin iniciar

**Respuesta tipo cuando Andrea pregunta:**
```
Avance global del equipo: 61%
Distribuido así: 7 en curso (avance promedio 58%) | 2 en revisión | 5 planificadas sin iniciar
```

---

### KPI-02: Tasa de completitud
**Qué es:** % de actividades Terminadas vs. total del período
**Umbral de preocupación:** < 50% al final de un sprint o mes
**Cómo lo reporta el agente:**
```
Completitud del mes: 42% (12 de 28 actividades terminadas)
⚠️  Está por debajo del 50%. El equipo cerró menos de la mitad de lo planificado.
```

---

### KPI-03: Actividades vencidas
**Qué es:** Cantidad de actividades con fecha pasada que no están Terminadas
**Umbral:** Cualquier vencida es señal de alerta — el agente siempre las menciona primero
**Cómo lo reporta:**
```
Vencidas: 3
- "Migración OC" (Andrés) — 4 días de retraso, 45% avance
- "Docs API" (Andrés) — 2 días, 70% avance
- "Capacitación financiero" (Carlos) — 1 día, 90% avance → casi lista
```

---

### KPI-04: Carga por responsable
**Qué es:** Cuántas actividades activas tiene cada persona del equipo
**Para qué sirve:** Detectar sobrecarga o desequilibrio
**Cuándo alerta:**
- Una persona con > 6 actividades activas → posible sobrecarga
- Una persona con 0 actividades activas → está disponible para tomar más
**Cómo lo reporta:**
```
Distribución de carga:
- Andrés: 5 actividades activas (la más alta del equipo)
- Laura: 3 actividades
- Carlos: 2 actividades → tiene capacidad disponible
```

---

### KPI-05: Insignias del equipo
**Qué son:** 4 indicadores de salud operativa con semáforo visual
**Para qué sirven:** Resumen rápido de si el equipo está cumpliendo

| Insignia | ¿La tiene el equipo hoy? | Qué significa tenerla |
|---|---|---|
| Tasa de completitud | ✅ Sí (75% terminadas) | Más del 70% de actividades cerradas |
| Actividades en tiempo | ❌ No (2 vencidas) | Hay retrasos activos |
| Avance promedio | ✅ Sí (61%) | El avance supera el 60% global |
| Sin bloqueos | ❌ No (2 bloqueadas) | Hay impedimentos sin resolver |

---

### KPI-06: Próximos hitos
**Qué es:** Actividades que vencen en los próximos 7 días y no están Terminadas
**Para qué sirve:** Planificar la semana
**Cómo lo reporta:**
```
Próximas a vencer esta semana:

🔴 "Revisión seguridad intranet" — mañana — Andrés — 35% avance (¡prioridad Alta!)
⚠️  "Exportar reportes PDF" — en 3 días — Laura — 60% avance
✅ "Documentar módulo SGC" — en 5 días — Carlos — 88% avance → va bien
```

---

### KPI-07: Distribución de estados
**Para qué sirve:** Ver si hay cuellos de botella en algún estado
**Señales de problema:**
- Muchas actividades en "Revision" sin moverse → Andrea no está revisando a tiempo
- Muchas en "Planificado" sin pasar a "En curso" → el equipo no arrancó
- Muchas en "Backlog" → hay trabajo sin planificar acumulado

---

*Última actualización: 2026-05-22 | Fuente: `dashboardService.ts` + dashboard de Helix*
