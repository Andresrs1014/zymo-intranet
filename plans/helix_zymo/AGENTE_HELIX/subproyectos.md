# Subproyectos — Helix Zymo

> Fuente directa: `helix-backend/src/routers/subproyectos.ts` + `prisma/schema.prisma`
> Ver también: [[flujo_trabajo]] | [[roi_y_valor]] | [[actividades_y_estados]]

---

## ¿Qué es un subproyecto?

Un subproyecto es el contenedor de actividades. Representa una iniciativa, proyecto o entregable del área de Desarrollo e Innovación. Agrupa actividades relacionadas y tiene asociados costos, retorno esperado y un cliente.

**Analogía:** Si Helix fuera un proyecto de software, los subproyectos serían los "epics" y las actividades serían las "historias de usuario".

---

## Campos de un subproyecto

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Identificador único |
| `nombre` | string | Nombre del proyecto/iniciativa (obligatorio) |
| `objetivo` | string? | Descripción del objetivo de negocio |
| `cliente` | string? | Cliente interno o externo beneficiado |
| `inversionEst` | float | Presupuesto estimado en COP (default: 0) |
| `retornoEsp` | float | Retorno esperado en COP (default: 0) |
| `activo` | boolean | Si está visible/activo (default: true) |

---

## Endpoints

```
GET    /api/subproyectos          → Lista todos los subproyectos activos
POST   /api/subproyectos          → Crea nuevo subproyecto
PUT    /api/subproyectos/:id      → Edita nombre, objetivo, cliente, inversión, retorno
DELETE /api/subproyectos/:id      → Elimina (solo si no tiene actividades)
```

---

## Gestión en la intranet

**Dónde:** Vista Config → pestaña "Subproyectos"
**Quién puede gestionar:** Usuarios con acceso a Helix (JWT válido)

El panel muestra:
- Lista de subproyectos con nombre, objetivo y badge "Activo"
- Botón "Nuevo subproyecto" → formulario inline
- Editar (lápiz) / Eliminar (papelera) por fila
- Expandir fila para ver objetivo, cliente, inversión y retorno

---

## Relación con actividades

- Un subproyecto puede tener **muchas actividades**
- Una actividad pertenece a **exactamente un subproyecto**
- Al eliminar un subproyecto, el sistema valida que no tenga actividades activas

---

## Uso en el Dashboard

El gestor puede **filtrar todo el dashboard** por subproyecto específico:
- Métricas solo de ese subproyecto
- Actividades bloqueadas de ese subproyecto
- ROI de ese subproyecto
- Carga del equipo en ese subproyecto

---

## Ejemplo de subproyectos reales de Grupo ZYMO

Típicamente el área de Desarrollo maneja iniciativas como:
- Implementación de módulos en la intranet
- Optimizaciones de procesos operativos
- Desarrollo de herramientas internas
- Auditorías y actualizaciones de sistemas

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/routers/subproyectos.ts` + `settings/SubprojectsPanel.tsx`*
