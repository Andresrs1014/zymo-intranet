# Reglas de Negocio — Helix Zymo

> Reglas extraídas directamente del código fuente. Son restricciones que el sistema ya aplica.
> Ver también: [[actividades_y_estados]] | [[flujo_trabajo]] | [[roles_y_permisos]]

---

## Reglas de actividad

**Regla H-01:** El campo `nombre` de una actividad tiene máximo 100 caracteres y es obligatorio.

**Regla H-02:** `fechaFin` debe ser igual o posterior a `fechaInicio`. El formulario valida esto antes de enviar.

**Regla H-03:** El `avance` es un entero entre 0 y 100 (inclusive). No se aceptan decimales.

**Regla H-04:** Los `puntos` (story points) van de 1 a 21. Valores fuera de rango son rechazados con error 400.

**Regla H-05:** El `responsableId` debe ser el ID de un usuario válido de la intranet. El backend resuelve nombre, iniciales y color desde la lista de usuarios.

**Regla H-06:** Una actividad puede ser `bloqueada: true` independientemente de su estado. Estar bloqueada no impide cambios de estado — es una flag adicional.

**Regla H-07:** El campo `dependenciaId` apunta a otra actividad del sistema. No hay validación circular en el backend — el gestor es responsable de evitar ciclos.

---

## Reglas de estado

**Regla H-08:** Los únicos estados válidos son exactamente: `"Backlog"`, `"Planificado"`, `"En curso"`, `"Revision"`, `"Terminado"`. Mayúsculas y tildes incluidas — no se acepta variante.

**Regla H-09:** No hay restricciones de transición de estado — se puede mover una actividad de `Backlog` directamente a `Terminado` si el gestor lo decide. Las transiciones son libres.

**Regla H-10:** Al cambiar estado a `Terminado` vía el endpoint `PATCH /estado`, el backend registra automáticamente `completadaEn = now()`.

---

## Reglas de subproyecto

**Regla H-11:** El `nombre` de un subproyecto es el único campo obligatorio.

**Regla H-12:** `inversionEst` y `retornoEsp` son floats ≥ 0. Valores negativos son rechazados.

**Regla H-13:** No se puede eliminar un subproyecto que tenga actividades asociadas — el backend retorna error 409.

---

## Reglas de costos

**Regla H-14:** Los tres campos de costo (`costoInversion`, `costoOptimizacion`, `costoEjecucion`) son floats ≥ 0, opcionales (default 0).

**Regla H-15:** El ROI se calcula server-side con la fórmula:
```
ROI = (retornoEsp - inversionEst) / inversionEst * 100
Margen = retornoEsp / inversionEst
```

**Regla H-16:** Clasificación de subproyectos por ROI:
- ROI > 50% → "Alto potencial"
- ROI > 20% → "Potencial favorable"
- ROI > 0% → "Retorno controlado"
- ROI ≤ 0% → "Revisar alcance"

---

## Reglas de prioridad

**Regla H-17:** Las únicas prioridades válidas son `"Alta"`, `"Media"`, `"Baja"`. La prioridad por defecto al crear es `"Media"`.

**Regla H-18:** La prioridad NO afecta el orden de columnas en el tablero — es visual únicamente. El gestor ordena manualmente.

---

## Reglas del dashboard

**Regla H-19:** Una actividad se considera "vencida" si `fechaFin < hoy` Y `estado != "Terminado"`.

**Regla H-20:** Los "próximos hitos" son actividades con `fechaFin` dentro de los próximos 7 días Y `estado != "Terminado"`, ordenadas por fecha ascendente, máximo 10.

**Regla H-21:** Las insignias se otorgan con estos umbrales:
- "Tasa de completitud" → se obtiene si ≥ 70% de actividades están Terminadas
- "Actividades en tiempo" → se obtiene si ≥ 80% de las activas no están vencidas
- "Avance promedio" → se obtiene si el avance global ≥ 60%
- "Sin bloqueos" → se obtiene si no hay ninguna actividad bloqueada

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/routers/actividades.ts` (validaciones zod) + `dashboardService.ts`*
