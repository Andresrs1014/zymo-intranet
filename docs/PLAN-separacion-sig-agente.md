# Plan — Separar el SIG de la intranet y poner al agente dentro del servidor

Estado: **borrador para decidir** (sin código). Base: lo que hoy existe en `sig-backend`, `backend/app/routers/sig_ia.py`, `frontend/src/components/sig/*` y `mcp001-intranet`.

## 1. Principio

> La intranet es el **único hub** y la **fuente de verdad**. Todo lo demás (agente, MCP, portales) es un cliente que se conecta a ella por contratos explícitos. Nada comparte base de datos con otro.

## 2. Qué hace cada pieza (responsabilidad única)

| Pieza | Responsabilidad única | No hace |
|---|---|---|
| **Intranet · módulo SIG** | Guardar documentos versionados (procedimientos, instructivos, formatos, anexos), extraer su texto, previsualizarlos y aprobar versiones | Analizar, correr LLM, guardar resultados de análisis |
| **Runtime de agentes** (nuevo, universal) | Ejecutar agentes: bucle de trabajo, herramientas, memoria, conexión a un LLM | Saber nada del SIG |
| **Agente analista SIG** | Es una *configuración* del runtime: rúbrica + herramientas + conector a la intranet | Editar documentos directamente |
| **Conectores** | Puerto de entrada/salida hacia un sistema (intranet hoy; otro mañana) | Lógica de análisis |
| **Portales** (panel en la intranet, MCP, CLI) | Interfaz delgada hacia el runtime | Lógica propia |

## 3. Qué sale del SIG de la intranet

Hoy el módulo mezcla almacenamiento y análisis. Inventario:

**Se queda (núcleo documental):** `areas`, `procedimientos`, `commits`, `instructivos`, `formatos`, `doc-anexos`, `archivos-pendientes`, extracción de texto (`textExtraction.ts`), vista previa PDF (`pdfPreview.ts`), flujograma imagen, cargos asignados a procedimiento.

**Sale (es del agente):**
- `routers/analisis.ts` y los modelos legacy `SigAnalisisCoherencia/Mejoras/Cargos/ProcVsInst/Completo` (las herramientas que los usaban ya se retiraron del MCP el 2026-09-28).
- `backend/app/routers/sig_ia.py`: `/analizar*`, `/chat`, `/editar-con-ia`, LightRAG (`indexar-lightrag`, `consultar-rag`, `rag-status`, `rag1/rag2`).
- Frontend: `SigAnalisisPanel`, `SigAnalisisInspector`, `SigAnalisisQueue`, `SigAnalisisSyncView`, `SigAiEditorPanel`, `SigRagPanel`.
- `routers/libertadora-backup.ts` y `SigLibertadoraBackup`: código muerto (nadie lo invoca).

**Decisión pendiente:** `auditorias.ts` (`SigAnalisisAuditoria`, `SigHallazgo`, `SigConsulta`) y `reportes-desarrollo.ts`.
- Hallazgos y consultas son la *memoria de trabajo del agente*. Mi recomendación es que migren al runtime y la intranet los lea por API para mostrarlos.
- `reportes-desarrollo` no es del SIG; convendría que sea su propio módulo.

**A verificar:** `docker-compose.yml` inyecta `SIG_DATABASE_URL` a `backend` y `zymo-worker`, pero no encontré ninguna referencia en `backend/app`. Si es un resto, se quita: nadie debería leer la base del SIG salvo `sig-backend`.

## 4. Topología en el servidor

```
        red interna del servidor (docker)
 ┌───────────────────────────────────────────────┐
 │  Intranet (hub)  ◄──API v1 / eventos──►  Runtime de agentes │
 │   sig-backend + sig-db                     ├─ agente analista SIG
 │                                            ├─ memoria + RAG propios
 │                                            └─ adaptador de LLM ──► Ollama local / API
 └───────────────────────────────────────────────┘
        ▲                                   ▲
   Portal en la intranet             MCP / CLI en el equipo
   (navegador)                       (solo piden y reciben)
```

- El agente vive **en el servidor**, en la misma red que la intranet: habla con ella directo, sin pasar por el equipo.
- El equipo de cómputo es un **cliente** (pide tareas, ve resultados); ya no es el puente que lleva datos de ida y vuelta.
- "Tipo Miss Minutes": un programa **residente** que reacciona a eventos (por ejemplo, "se aprobó una versión nueva") y conserva memoria entre ejecuciones, en vez de un script que alguien lanza a mano.

## 5. Cómo escribe el agente

- **Nunca directo sobre lo aprobado.** Sigue el rol de la rúbrica: analista, no editor.
- Usa una cuenta de servicio propia (el rol `IA_SIG` ya existe) con permisos mínimos.
- Sus salidas son **propuestas**: hallazgos, consultas al usuario y, si se decide, versiones en estado pendiente. El flujo de aprobación que ya exige gerente las valida.
- Toda escritura queda con autor, versión analizada y qué regla de la rúbrica la originó.

## 6. Cómo se automejora (solo dentro de la rúbrica)

- La rúbrica pasa a ser un artefacto **versionado y con identificadores por regla**.
- El agente puede **proponer cambios a la rúbrica**, nunca a su código ni a su configuración.
- Cada propuesta se evalúa contra un banco de pruebas (defectos sembrados + hallazgos ya validados por humanos) y **solo un humano la activa**.
- Métricas por regla: precisión, recall, reproducibilidad, tasa de cierre de hallazgos.

## 7. Universalidad: el runtime como molde

El núcleo solo conoce cinco puertos. Un agente nuevo es una configuración nueva, no código nuevo:

| Puerto | Qué define | Analista SIG | Un investigador (ejemplo) |
|---|---|---|---|
| **Fuente** | De dónde lee | Intranet | Web / carpeta |
| **Destino** | Dónde deja resultados | Hallazgos (propuestas) | Informes / notas |
| **Cerebro** | Qué LLM usa | Local o API | Igual |
| **Memoria** | Qué recuerda y cómo busca | Hallazgos + RAG | Fuentes + RAG |
| **Tarea** | Qué debe lograr y con qué reglas | Rúbrica de 4 lentes | Rúbrica de investigación |

## 8. Fases (estrangulador: nada se borra hasta que su reemplazo funciona)

| Fase | Entrega | Criterio de salida |
|---|---|---|
| **0. Contratos** | API v1 del SIG (lectura de documentos y versiones, escritura de propuestas), eventos, esquema de hallazgo | Documento revisado y aprobado; sin código |
| **1. Runtime mínimo** | Contenedor en el servidor con un agente que reproduce el flujo actual (contexto → análisis → envío) | Misma auditoría que hoy sobre 3 procedimientos reales |
| **2. Memoria y eventos** | Hallazgos en el almacén del agente; reacciona a "versión aprobada" | Re-análisis automático que cierra hallazgos previos (§8 de la rúbrica) |
| **3. Adelgazar el SIG** | Quitar lo de la sección 3 en este orden: marcar obsoleto → ocultar en UI → borrar | `sig-backend` sin endpoints de análisis; frontend sin paneles de IA |
| **4. Panel del agente** | Sección en la intranet que consume la API del runtime | Se ven tareas, hallazgos y estado sin tocar el MCP |
| **5. Automejora de rúbrica** | Banco de pruebas + flujo de propuestas de cambio | Una propuesta evaluada y activada por un humano |
| **6. Segundo agente** | Un agente distinto (investigador) solo con configuración | Funciona sin cambiar el núcleo |

## 9. Decisiones que necesito de ti

1. **Hallazgos y consultas:** ¿migran al runtime (recomendado) o se quedan en `sig-db`?
2. **Lenguaje del runtime:** Python (ya está en tu stack y pediste Python para análisis de datos) o Rust/Go como en `aura-portable`. Recomiendo Python ahora con contratos HTTP/JSON neutrales, para poder reescribirlo después sin tocar la intranet.
3. **LLM en el servidor:** ¿local (Ollama; depende de la RAM y CPU libres del servidor) o API? Con API, el texto de los procedimientos sale de la empresa: conviene decidirlo conscientemente.
4. **`reportes-desarrollo`:** ¿módulo propio o se queda donde está?
5. **Relación con `aura-portable`:** ¿es el mismo producto con otro despliegue, o el runtime del servidor es un proyecto distinto que solo comparte ideas?

## 10. Riesgos

- Borrar antes de tener reemplazo dejaría al analista sin herramientas: por eso el orden estrangulador.
- El agente residente con permisos de escritura es un riesgo de seguridad: cuenta de servicio mínima, solo propuestas, todo auditado.
- Dos fuentes de verdad para hallazgos durante la migración: fijar una fecha de corte y migrar los abiertos.
