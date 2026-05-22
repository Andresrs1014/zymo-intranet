# Reglas de Negocio — Helix Zymo

> Las reglas que el sistema aplica automáticamente y que el agente debe conocer para dar respuestas correctas.
> Ver también: [[actividades_y_estados]] | [[flujo_trabajo]]

---

## Reglas que el agente debe recordar siempre

### Sobre los estados
- Solo existen 5 estados válidos: Backlog, Planificado, En curso, Revision, Terminado
- **No hay restricciones de transición** — se puede mover de Backlog a Terminado directamente si el gestor lo decide
- Cuando una actividad pasa a Terminado, el sistema registra automáticamente la fecha de cierre

### Sobre vencidas
- Una actividad está **vencida** si su fecha límite ya pasó Y no está en estado Terminado
- Estar en Terminado siempre saca la actividad del conteo de vencidas, sin importar cuándo se cerró

### Sobre prioridades
- Solo existen 3 prioridades: Alta, Media, Baja
- La prioridad **no cambia automáticamente** — solo el equipo la cambia
- Una actividad Alta vencida es la situación más crítica que puede reportar el agente

### Sobre bloqueos
- Estar bloqueada es independiente del estado — una actividad puede estar "En curso" Y "bloqueada" al mismo tiempo
- El bloqueo solo se resuelve manualmente (alguien tiene que desmarcar el checkbox)

---

## Lo que el sistema NO hace (que el agente debe saber para no confundir)

| El agente podría asumir que... | La realidad es... |
|---|---|
| "El sistema avanza el estado solo cuando el avance llega a 100%" | ❌ El estado nunca cambia automáticamente — siempre es manual |
| "Al cerrar una actividad, el sistema avisa al gestor" | ❌ Solo hay notificaciones automáticas para vencidas y bloqueadas (en implementación) |
| "Si una actividad depende de otra, no se puede iniciar antes" | ❌ El sistema registra la dependencia pero no la bloquea automáticamente |
| "Los costos se calculan solos" | ❌ Los costos de cada actividad los ingresa manualmente el responsable |

---

## Validaciones que el sistema sí aplica

Estas son restricciones reales — si alguien intenta saltárselas, el sistema las rechaza:

- La fecha de fin debe ser igual o posterior a la fecha de inicio
- El avance debe ser un número entre 0 y 100
- El nombre de la actividad no puede quedar vacío
- No se puede eliminar un subproyecto que tiene actividades activas
- Los costos no pueden ser valores negativos

---

## Reglas para calcular métricas (el agente usa esto internamente)

- **Vencida:** `fechaFin < hoy` Y `estado ≠ Terminado`
- **Próxima a vencer:** `fechaFin` en los próximos 7 días Y `estado ≠ Terminado`
- **En riesgo:** `fechaFin` en ≤ 5 días Y `avance < 50%`
- **ROI:** `(retornoEsperado - inversión) / inversión × 100`
- **Insignia "Sin bloqueos":** solo se obtiene si hay exactamente 0 actividades con `bloqueada = true`

---

*Última actualización: 2026-05-22 | Fuente: código fuente helix-backend + comportamiento observado en producción*
