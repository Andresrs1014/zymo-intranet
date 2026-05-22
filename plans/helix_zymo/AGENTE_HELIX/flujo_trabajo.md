# Flujo de Trabajo — Helix Zymo

> Este nodo describe cómo fluye el trabajo en el área: quién hace qué en cada paso.
> Ver también: [[actividades_y_estados]] | [[subproyectos]] | [[roles_y_permisos]]

---

## El ciclo completo de una actividad

```
Andrea (o el equipo) identifica algo que hay que hacer
        ↓
Se crea como actividad en Backlog (con nombre, fecha y responsable)
        ↓
Andrea o el gestor la mueve a Planificado cuando entra al sprint
        ↓
El responsable la arranca → En curso (y actualiza el avance periódicamente)
        ↓
El responsable termina su parte → la mueve a Revisión
        ↓
Andrea o el gestor la revisa → la cierra en Terminado
```

---

## Quién hace qué

| Paso | Quién lo hace normalmente |
|---|---|
| Crear el subproyecto (iniciativa) | Andrea o el líder del proyecto |
| Crear actividades y asignarlas | Andrea, Andrés o cualquier miembro del equipo |
| Planificar (mover a Planificado) | Andrea o el gestor |
| Iniciar ejecución (mover a En curso) | El responsable de la actividad |
| Actualizar el avance (%) | El responsable, al menos 2 veces por semana |
| Mover a Revisión | El responsable cuando termina su parte |
| Cerrar en Terminado | Andrea o el gestor después de revisar |
| Marcar como bloqueada | Quien detecta el impedimento |

---

## Señales de que el flujo está funcionando bien

- Las actividades avanzan de izquierda a derecha en el tablero semanalmente
- El avance % se actualiza con regularidad (no está en 0% después de días "En curso")
- No hay acumulación de actividades en un solo estado
- Las actividades en Revisión no duran más de 2 días sin cerrarse

---

## Señales de que el flujo tiene problemas

| Señal | Posible causa | Qué hacer |
|---|---|---|
| Actividad lleva días en Planificado sin iniciar | El responsable no arrancó o no sabe que le toca | Recordárselo |
| Avance no cambió en 5+ días | Abandonada, bloqueada o sin tiempo | Preguntar al responsable |
| Muchas actividades en Revisión sin cerrar | Andrea o el gestor no está revisando | Bloque de revisión en la agenda |
| El responsable dice que terminó pero no movió el estado | Falta cultura de actualización | Recordar que deben mover el estado ellos mismos |

---

## El tablero Scrum — cómo lo usa el equipo

El tablero es la vista principal del área. Tiene 5 columnas (una por estado) y las tarjetas se pueden arrastrar entre columnas con el mouse.

Cada tarjeta muestra:
- Nombre de la actividad
- Avatar del responsable (iniciales en círculo de color)
- Prioridad (chip rojo/amarillo/gris)
- Barra de avance
- Fecha de entrega

**Uso recomendado:** El equipo revisa el tablero al inicio de cada jornada. Andrea lo revisa al inicio de semana para ver el panorama completo.

---

## El Gantt — para ver el tiempo

La vista Gantt muestra todas las actividades como barras en una línea de tiempo. Sirve para:
- Ver si hay actividades que se solapan en el mismo responsable
- Identificar semanas muy cargadas vs. semanas vacías
- Detectar actividades cuya barra ya pasó la línea de hoy (vencidas visualmente)

El botón "Hoy" lleva el gantt al día actual automáticamente.

---

*Última actualización: 2026-05-22 | Fuente: observación del uso real del módulo Helix*
