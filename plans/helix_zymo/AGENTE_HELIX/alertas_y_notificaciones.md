# Alertas y Notificaciones — Helix Zymo

> Fuente directa: `helix-backend/src/services/alertaService.ts` (implementación en T12)
> Ver también: [[metricas_y_kpis]] | [[actividades_y_estados]] | [[reglas_de_negocio]]

---

## Tipos de alertas automáticas

Helix genera 4 tipos de alertas que el agente debe conocer para informar proactivamente:

| Tipo | Condición | Urgencia |
|---|---|---|
| **Vencida** | `fechaFin < hoy` AND `estado != "Terminado"` | ALTA — notificar inmediatamente |
| **Próxima a vencer** | `fechaFin` en ≤ 2 días AND `estado != "Terminado"` | ALTA — actuar hoy |
| **En riesgo** | `fechaFin` en ≤ 5 días AND `avance < 50%` | MEDIA — revisar con responsable |
| **Bloqueada prolongada** | `bloqueada = true` AND bloqueada desde hace > 2 días | ALTA — escalar al gestor |

---

## Canal de notificación (T12 — pendiente)

Las alertas se enviarán por:
- **WhatsApp:** Mensaje directo al responsable vía `alertaService.ts`
- **Historial interno:** Registro en tabla `HelixAlerta` en PostgreSQL
- **Dashboard:** Panel de bloqueos y próximos hitos (ya implementado en T10)

---

## Endpoint de alertas automáticas

```
GET /api/alertas/automaticas
→ {
    vencidas: HelixActividad[],
    proximasAVencer: HelixActividad[],      // ≤ 2 días
    enRiesgo: HelixActividad[],             // ≤ 5 días + avance < 50%
    bloqueadas: HelixActividad[]
  }
```

---

## Estructura de una alerta (HelixAlerta)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | ID de la alerta |
| `subproyectoId` | number? | Subproyecto relacionado |
| `cambio` | string | Descripción del evento que generó la alerta |
| `actividadId` | number? | Actividad relacionada |
| `actividadNombre` | string? | Nombre de la actividad |
| `destinatarios` | JSON | Array de `{ nombre, email, phone }` |
| `canal` | string | "email" \| "whatsapp" \| "auto" |
| `createdAt` | datetime | Cuándo se generó |

---

## Job automático (node-cron, T12)

El helix-backend ejecutará un job cada hora que:
1. Consulta actividades vencidas, próximas y bloqueadas
2. Compara con el historial de alertas para no duplicar
3. Genera mensajes WhatsApp por responsable
4. Registra en `HelixAlerta`

**Frecuencia:** Cada hora (configurable)
**Horario:** Solo días hábiles, 8am–6pm Colombia

---

## Mensaje WhatsApp tipo

```
🚨 ACTIVIDAD VENCIDA — Helix ZYMO

Actividad: "Migración base de datos OC"
Subproyecto: Modernización Intranet
Fecha límite: 20 mayo 2026 (hace 2 días)
Avance actual: 45%

Por favor actualiza el estado en: zymointranet.com/planeacion/helix
```

---

## Lo que el agente debe hacer con alertas

Cuando el usuario pregunte por el estado de los proyectos, el agente debe:
1. Consultar `GET /api/alertas/automaticas`
2. Resumir: "Hay X actividades vencidas, Y próximas a vencer y Z bloqueadas"
3. Listar las más críticas por nombre, responsable y días de retraso
4. Sugerir acciones concretas: "Recomiendo revisar con [responsable] la actividad [nombre] que lleva [N] días sin avance"

---

*Última actualización: 2026-05-22 | Fuente: `helix-backend/src/services/alertaService.ts` (placeholder) + `prisma/schema.prisma` (HelixAlerta model)*
