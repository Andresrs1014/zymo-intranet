# Preguntas Frecuentes — Andrea Reyes

> Este nodo anticipa las preguntas que Andrea hace con más regularidad y define cómo el agente debe responderlas.
> Ver también: [[HELIX_MENTE]] | [[metricas_y_kpis]] | [[alertas_y_notificaciones]] | [[actividades_y_estados]]

---

## Sobre el estado general del área

### "¿Cómo vamos?"
**Lo que el agente hace:** Consulta el dashboard y resume los números clave con señales de alerta
**Respuesta tipo:**
```
Estado del área — hoy 22 de mayo:

📋 Actividades activas: 18
   - En curso: 7
   - En revisión: 2
   - Planificadas: 5
   - Backlog: 4

⚠️  3 actividades vencidas (llevan entre 1 y 4 días de retraso)
🔴 2 actividades bloqueadas
✅ Avance global del equipo: 61%

Las 3 vencidas son de Andrés (2) y Carlos (1). ¿Quieres el detalle?
```

---

### "¿Qué está atrasado?"
**Lo que el agente hace:** Lista las actividades con fechaFin pasada que no están Terminadas, ordenadas por días de retraso
**Respuesta tipo:**
```
Actividades vencidas (3):

1. "Migración módulo OC a nueva BD" — Andrés
   Venció hace 4 días | Avance: 45% | Subproyecto: Modernización Intranet

2. "Documentación API de compras" — Andrés
   Venció hace 2 días | Avance: 70% | Subproyecto: Modernización Intranet

3. "Capacitación módulo financiero" — Carlos
   Venció ayer | Avance: 90% | Subproyecto: Formación Equipo
   → Esta está casi lista, probablemente se cierra hoy.
```

---

### "¿Qué está bloqueado?"
**Lo que el agente hace:** Lista actividades con `bloqueada: true`, con contexto de cuánto llevan bloqueadas
**Respuesta tipo:**
```
Actividades bloqueadas (2):

1. "Integración Helix con WhatsApp" — Andrés
   Bloqueada desde hace 3 días
   Subproyecto: Helix Zymo
   → Posible causa: dependencia de acceso a la API de WhatsApp Business

2. "Configuración servidor de correo SGC" — Laura
   Bloqueada desde hace 1 día
   Subproyecto: Automatizaciones SGC
```

---

### "¿Hay algo urgente que deba revisar hoy?"
**Lo que el agente hace:** Combina vencidas + bloqueadas + próximas a vencer con prioridad Alta
**Respuesta tipo:**
```
🔴 ATENCIÓN INMEDIATA:
- "Migración módulo OC" (Andrés) — vencida 4 días, solo 45% de avance

⚠️  REVISAR HOY:
- "Integración WhatsApp" — bloqueada 3 días sin avance
- "Revisión de seguridad intranet" — vence mañana, avance 35% (Alta prioridad)

✅ Lo demás está dentro del tiempo esperado.
```

---

## Sobre actividades específicas

### "¿Cómo va [nombre de actividad o subproyecto]?"
**Respuesta tipo:**
```
"Helix Zymo — Módulo de Dashboard"

Estado: En curso
Responsable: Andrés Quintero
Avance: 78%
Fecha límite: 28 de mayo (quedan 6 días)
Subproyecto: Helix Zymo

Va bien. Si mantiene el ritmo actual, debería estar listo antes de la fecha.
```

---

### "¿Qué tiene pendiente [nombre de persona]?"
**Respuesta tipo:**
```
Andrés Quintero — actividades activas (5):

1. "T11 Vista Estados/Reports" — En curso — 30% — Vence 25 mayo
2. "T12 Alertas y WhatsApp" — Planificado — 0% — Vence 28 mayo
3. "Migración módulo OC" — En curso — 45% — VENCIDA hace 2 días ⚠️
4. "Documentación API" — En curso — 70% — VENCIDA ayer ⚠️
5. "Fix bug login producción" — Backlog — 0% — Sin fecha

Tiene 2 actividades vencidas. Recomiendo revisar con él la prioridad real esta semana.
```

---

### "¿Cuándo termina [subproyecto]?"
**Respuesta tipo:**
```
Subproyecto: "Helix Zymo"

Actividades totales: 14
Terminadas: 10 (71%)
En curso: 3
Pendientes: 1

Actividad más lejana activa: "T14 Pulido final" — vence 15 junio
Estimado de cierre del subproyecto: segunda semana de junio si se mantiene el ritmo actual.
```

---

## Sobre el equipo

### "¿Quién está más cargado?"
**Respuesta tipo:**
```
Carga actual del equipo:

1. Andrés Quintero — 5 actividades activas | Avance promedio: 52%
2. Laura García — 3 actividades activas | Avance promedio: 68%
3. Carlos Méndez — 2 actividades activas | Avance promedio: 85%

Andrés tiene la carga más alta. Carlos va bien, casi terminando sus tareas actuales.
```

---

### "¿Quién está cumpliendo mejor?"
**Respuesta tipo:**
```
Rendimiento del equipo — últimas 4 semanas:

🥇 Carlos Méndez — 8 actividades terminadas | 0 vencidas | Avance promedio: 91%
🥈 Laura García — 5 actividades terminadas | 1 vencida (resuelta) | Avance: 74%
🥉 Andrés Quintero — 12 actividades terminadas | 2 vencidas activas | Avance: 61%

Nota: Andrés tiene más volumen que el resto — sus vencidas son en parte por carga alta.
```

---

## Sobre valor y ROI

### "¿Qué subproyecto tiene mejor ROI?"
**Respuesta tipo:**
```
ROI estimado por subproyecto:

1. "Automatización reportes OC" — ROI: 320% — Alto potencial ✅
   Inversión: $1.2M | Retorno esperado: $5M (ahorro anual)

2. "Helix Zymo" — ROI: 180% — Potencial favorable ✅
   Inversión: $3.8M | Retorno esperado: $10.6M (eficiencia operativa)

3. "Módulo financiero v2" — ROI: 40% — Retorno controlado
   Inversión: $2.1M | Retorno esperado: $2.94M

Recomendación: Los dos primeros justifican priorización ante gerencia.
```

---

## Preguntas que el agente NO puede responder

- **"¿Puedes moverle el estado a esta actividad?"** → "No modifico actividades directamente. Puedes hacerlo en el tablero Scrum o decirme cuál y yo te confirmo cómo."
- **"¿Puedes crear una nueva actividad para X?"** → "No creo actividades. Hazlo desde el botón 'Nueva actividad' en el tablero."
- **"¿Cuánto presupuesto me queda?"** → "No tengo acceso al módulo financiero de la empresa. Los datos de costo en Helix son los que el equipo registró manualmente."
- **"¿Cuándo va a estar listo X exactamente?"** → "Puedo darte el estimado basado en el avance y fecha límite actuales, pero la fecha real la controla el equipo."

---

*Ver [[alertas_y_notificaciones]] para lo que el agente reporta sin que Andrea pregunte*
*Ver [[metricas_y_kpis]] para los indicadores que respaldan estas respuestas*
