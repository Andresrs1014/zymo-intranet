# Alertas y Notificaciones — Helix Zymo

> Este nodo define cuándo el agente debe alertar proactivamente, sin que Andrea pregunte.
> Ver también: [[metricas_y_kpis]] | [[actividades_y_estados]] | [[preguntas_frecuentes_andrea]]

---

## Cuándo el agente alerta sin que le pregunten

El agente debe mencionar estas situaciones al inicio de una conversación si existen:

| Situación | Umbral | Urgencia |
|---|---|---|
| Actividades vencidas | fechaFin pasó + no Terminada | 🔴 ALTA — siempre mencionar |
| Próximas a vencer | vence en ≤ 2 días + no Terminada | 🔴 ALTA — mencionar hoy |
| En riesgo | vence en ≤ 5 días + avance < 50% | ⚠️ MEDIA — mencionar |
| Bloqueada prolongada | bloqueada > 2 días | 🔴 ALTA — escalar |
| Actividad en Revisión > 2 días | sin mover a Terminado | ⚠️ MEDIA — Andrea debe revisar |

---

## Apertura proactiva de conversación

Cuando Andrea abre el chat, el agente saluda con un resumen de alerta si hay algo urgente:

**Si hay alertas:**
```
Hola Andrea. Antes de que me preguntes, hay 2 cosas que necesitan tu atención hoy:

🔴 "Migración módulo OC" (Andrés) — vencida hace 3 días, avance 45%
⚠️  "Revisión de seguridad" — vence mañana, prioridad Alta, avance 35%

¿Quieres el detalle de alguna o prefieres el resumen completo del área?
```

**Si todo está bien:**
```
Hola Andrea. Todo el equipo está dentro de los tiempos esperados hoy.
Avance global: 67% | Completadas esta semana: 4

¿En qué te ayudo?
```

---

## Alertas automáticas por WhatsApp (cuando esté implementado)

El sistema enviará mensajes directos a los responsables cuando:

**Actividad vencida:**
```
🚨 ACTIVIDAD VENCIDA — Helix ZYMO

Hola [nombre], tu actividad "[nombre actividad]" venció ayer.
Avance actual: 45%
Subproyecto: [nombre]

Por favor actualiza el estado en la intranet o avísale a Andrea.
```

**Próxima a vencer:**
```
⏰ RECORDATORIO — Helix ZYMO

Hola [nombre], "[nombre actividad]" vence mañana.
Avance actual: 35%

Si necesitas más tiempo, coordina con Andrea hoy.
```

**Actividad bloqueada sin resolución:**
```
🔒 BLOQUEO SIN RESOLVER — Helix ZYMO

"[nombre actividad]" lleva 3 días bloqueada.
Responsable: [nombre]
Subproyecto: [nombre]

Andrea fue notificada. Por favor actualiza el estado del bloqueo.
```

---

## Lo que el agente registra como alerta

Cada alerta queda en el historial del sistema para que Andrea pueda ver:
- Qué se notificó
- A quién
- Cuándo
- Si se resolvió o sigue activa

Esto permite a Andrea hacer seguimiento sin tener que preguntar "¿le avisaste a X?".

---

## Lo que el agente NO hace con alertas

- No envía mensajes directamente (eso lo hace el sistema automático)
- No marca actividades como Terminadas aunque el responsable diga que ya terminó
- No elimina alertas del historial
- No decide qué actividad debe priorizarse sobre otra — eso lo decide Andrea

---

*Última actualización: 2026-05-22 | Fuente: `dashboardService.ts` + `alertaService.ts` (en implementación)*
