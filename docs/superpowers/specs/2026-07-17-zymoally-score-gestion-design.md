# Score de Gestión de Tickets — diseño y documento de socialización

**Fecha:** 2026-07-17
**Estado:** en discusión con líderes — ajustar antes de implementar el cálculo final
**Procedimiento base:** `C:\procedimientos\Planeacion\gestion de tickets 2026.docx`

---

## 1. La idea en una frase

No vamos a medir **cuántos tickets cierra cada persona**. Vamos a medir **qué tan bien los gestiona** — aunque eso a veces signifique que alguien con menos tickets cerrados tenga un score más alto que alguien con más.

## 2. Por qué (la analogía)

En League of Legends, el KDA (kills/muertes/asistencias) es la estadística que todo el mundo mira primero — pero cualquiera que juegue sabe que no siempre refleja el impacto real. Hay partidas donde alguien siente que jugó excelente y el KDA le queda bajo; y hay KDAs altos que en realidad no ganaron la partida para el equipo. El KDA es una foto rápida, no la verdad completa.

Acá pasa lo mismo con "tickets cerrados": un ticket cerrado en 10 minutos sin ninguna nota, sin evidencia, y que 3 días después toca reabrir porque no se resolvió de verdad — **no es una buena gestión**, aunque cuente como "cerrado". Y un ticket que tomó más tiempo pero quedó bien documentado, dentro de los plazos, y nunca se tuvo que tocar de nuevo — **sí lo es**, aunque el número crudo de "cerrados" de esa persona sea menor.

Lo que buscamos con este score es encontrar a la gente que **realmente entiende cómo funciona la empresa y gestiona sus procedimientos correctamente** — no a quien mueve más rápido el estado de un ticket.

## 3. Qué SÍ y qué NO mide

**No mide:**
- Si la respuesta a un ticket fue "buena noticia" o "mala noticia" para quien lo radicó.
- Velocidad pura (cerrar rápido no es automáticamente mejor).
- Volumen (tener muchos tickets asignados no penaliza ni premia por sí solo).

**Sí mide:**
- Si hubo una respuesta real, no silencio.
- Si esa respuesta quedó dentro de los tiempos esperados (sin ser el único factor).
- Si quedó documentada de verdad (no solo un clic de "Cerrado").
- Si esa resolución se sostuvo en el tiempo (no tuvo que reabrirse).

**El verdadero "enemigo" no es una respuesta negativa — es el silencio.** Un ticket sin ninguna acción durante días pesa mucho más negativo que uno resuelto rápido con un "no aplica" bien sustentado.

## 4. Las 4 señales (el "KDA" de un ticket)

| Señal | Qué mide | Ya lo tenemos hoy |
|---|---|---|
| **Respuesta** | ¿Hubo al menos una acción o cambio de estado real? (vs. silencio total) | ✅ Bitácora (`ZymoPqrAction`) |
| **Tiempo** | ¿Se atendió dentro del SLA de su prioridad? (Fase C — 7am-7pm horas laborales) | ✅ `slaElapsedHours` / `slaLimitHours` |
| **Documentación** | ¿Hay bitácora + evidencia real, o solo se cambió el estado? | ✅ `ZymoPqrAction` + `ZymoPqrEvidence` |
| **Estabilidad** | ¿El ticket se reabrió o escaló después de darse por resuelto? | ⚠️ Inferible de la secuencia de acciones (no hay campo directo — no hace falta crearlo, se calcula de la bitácora) |

Ninguna señal por sí sola cuenta la historia completa — igual que el KDA solo no dice si alguien jugó bien. El score es la combinación de las 4.

## 5. Ejemplo (para mostrarles a los líderes)

**Ticket A** — Prioridad Alta (24h SLA). Se responde en 3 horas, se cierra, sin ninguna nota ni evidencia adjunta. Dos semanas después el cliente vuelve a escribir por lo mismo y toca reabrirlo.
→ Respondió rápido, pero sin documentar y sin sostenerse. Score bajo, a pesar de la velocidad.

**Ticket B** — Misma prioridad. Se responde en 20 horas (dentro del límite, pero al filo), con 3 notas de bitácora explicando la causa raíz y una evidencia adjunta. Nunca se reabre.
→ Más lento, pero completo y sostenido. Score alto.

**Ticket C** — Prioridad Baja. Pasan 6 días sin ninguna acción registrada.
→ Silencio. Score muy bajo, independientemente de si "no era urgente".

## 6. Dónde se ve esto en la intranet

- **Perfil individual** ("Gestionar mis tickets", Operativo) — ya construido: panel estilo "historial de partidas" con el score personal y desglose por plataforma/área.
- **Ranking/leaderboard** (nuevo, este documento) — vive en el **Dashboard de ZymoAlly** (no una página aparte): quién ha gestionado mejor por plataforma, y por supervisor/coordinador. Mismo criterio visual que el dashboard ya tiene ("Regla del Vestido Rojo" — un protagonista, resto neutral), con un "factor wow" cuidado pero sin ensuciar la lectura de los datos.

## 7. Próximo paso — socializar antes de calcular el score final

Este documento (o una versión resumida de él) es el que se le muestra a cada líder: **"así los vamos a medir, ¿qué les parece?"** — la idea es ajustar los pesos/criterios con su retroalimentación antes de que el número "oficial" empiece a circular. Preguntas abiertas para esa conversación:

1. ¿Las 4 señales tienen el mismo peso, o alguna debería pesar más? (ej. ¿documentación pesa más que estabilidad, o al revés?)
2. ¿Hay algo del procedimiento oficial (`gestion de tickets 2026.docx`) que el score debería reflejar y hoy no captura?
3. ¿El ranking debe ser público para todo el equipo, o solo visible para cada líder sobre su propia gente?

## 8. Visión futura — minería de procesos (NO para ahora)

La bitácora de cada ticket ya guarda, en orden, cada cambio de estado con su fecha — eso es exactamente la materia prima de la **minería de procesos** (process mining): descubrir cómo se comporta la empresa en la práctica, no solo cómo dice el manual que debería comportarse.

La conexión natural es con **SIG** (que ya analiza procedimientos con IA/LightRAG) + el **directorio** (quién hace qué) — algún día, cruzar "las rutas reales que toma un ticket" con "el procedimiento documentado en SIG" podría mostrar visualmente todas las rutas posibles que un procedimiento puede tomar en la vida real, no solo el camino feliz del manual.

**Por qué no ahora:** se necesitan meses de datos reales acumulados para que el mapa de rutas tenga sentido estadístico. El score de personas no depende de esto — lo alimenta, pero es un proyecto separado y posterior.

## 9. Nota aparte — red de agentes (OpenClaw/n8n)

El usuario mencionó (2026-07-17) que va a comprar un servidor nuevo para montar una red de agentes con OpenClaw (y posiblemente n8n), con la idea de conectarla eventualmente con este score — "como si potenciara un NPS". Sin detalle todavía; **explícitamente pospuesto** hasta terminar el trabajo de tickets. No es parte del alcance de este documento.
