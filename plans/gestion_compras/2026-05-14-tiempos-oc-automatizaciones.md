# Tiempos y métricas — OC Automatizaciones (módulo Compras)

Este documento resume **qué tiempos registra, calcula o muestra** la plataforma intranet para el flujo de **órdenes de servicio / solicitudes de compra** (OC Automatizaciones). Basado en el código del backend (`app/models/oc.py`, `app/routers/oc/kpis.py`, `app/routers/oc/solicitudes.py`, `app/agents/tools/oc_tools.py`) y el frontend (lista de solicitudes, KPIs).

---

## 1. Marcas de tiempo guardadas en cada solicitud (`oc_solicitudes`)

Son **fechas/horas puntuales**; no son “duraciones” por sí solas, pero permiten calcular intervalos entre etapas.

| Campo | Significado operativo (resumen) |
|--------|----------------------------------|
| `fecha_solicitud` | Momento en que se registró la solicitud (webhook PA, creación interna u operativo). |
| `fecha_asignacion` | Cuando compras asigna auxiliar (`auxiliar_id`). |
| `fecha_cotizacion` | Cuando queda cargada la cotización en flujo (marca de “cotización lista” a nivel proceso). |
| `fecha_aprobacion` | Cuando la cotización es aprobada por directivo/auxiliar según reglas de negocio. |
| `fecha_envio_oc` | Cuando se envía la OC al proveedor (estado hacia `oc_enviada`, etc.). |
| `fecha_en_plataforma` | Cuando se confirma ingreso en sistema logístico / plataforma. |
| `fecha_recibido` | Confirmación de recepción física (coordinador / `marcar-entregada`). |
| `fecha_cerrado` | Cierre formal del ciclo (`cerrada`). |
| `created_at` / `updated_at` | Auditoría técnica de fila. |

**Otros campos de fecha (negocio / logística, no etapa de workflow OC):**

- `fecha_proximo_mantenimiento` — solo solicitudes tipo mantenimiento.
- `fecha_estimada_entrega` / `fecha_confirmada_entrega` — gestión de entrega.
- `fecha_recibida_factura` — vínculo con flujo contable en la solicitud.

---

## 2. KPIs globales (`GET /api/oc/kpis`)

Expuestos en la pantalla **Dashboard KPIs** (`/oc/kpis`). Lo **explícitamente temporal** es:

| Métrica | Qué mide | Cálculo (código) |
|---------|-----------|-------------------|
| **`tiempo_promedio_cotizacion_dias`** | Tiempo medio desde la solicitud hasta tener **cotización registrada** | Media en SQLite: `AVG(julianday(fecha_cotizacion) - julianday(fecha_solicitud))` sobre filas con `fecha_cotizacion IS NOT NULL`, excluyendo archivadas. **Unidades: días.** |
| **`reprocesos_total`** | Cantidad de eventos de historial marcados como reproceso | Cuenta de filas `oc_historial_estados` con `es_reproceso = true` (no archivadas). |
| **`tiempo_promedio_reproceso_dias`** | Tiempo medio para “salir” de un reproceso | Por cada entrada de reproceso, se busca la **siguiente** entrada del mismo historial con `es_reproceso = false`; la diferencia en días se promedia. **Unidades: días.** |

**Relacionados con calidad de proceso (conteos, no duración):**

- `correcciones_directivo` — eventos con `tipo_accion == "correccion_directivo"`.
- `rechazos_solicitud` / `rechazos_cotizacion` — cancelaciones en historial.

El resto del KPI (por estado, plataforma, valor aprobado, tendencia mensual, etc.) **no son tiempos**, son volúmenes o montos.

---

## 3. Historial de estados (`oc_historial_estados`)

Cada cambio relevante de estado puede generar una fila con **`fecha`** (timestamp UTC típico). De ahí se derivan:

- **Duración por etapa** en una solicitud concreta.
- Promedios por transición en herramientas de agente (ver siguiente sección).

Campos útiles: `estado_anterior`, `estado_nuevo`, `es_reproceso`, `tipo_accion`, `fecha`.

---

## 4. Timeline por solicitud (`GET /api/oc/solicitudes/{id}/tiempos`)

Delega en `ver_timeline_solicitud` (`oc_tools.py`). Devuelve, por cada entrada del historial:

- **`duracion_horas`** — tiempo hasta la **siguiente** transición; en el último tramo, tiempo transcurrido **hasta ahora** (estado actual).
- **`total_horas_proceso`** — suma de esas duraciones (incluye el tramo “en curso” del estado final).
- **`supera_limite`** — si existe un umbral configurado para esa pareja de estados y la duración lo supera.

No sustituye un informe contable; es una **vista operativa** del proceso.

---

## 5. Límites esperados por etapa (agentes / alertas)

En `app/agents/tools/oc_tools.py`, constante **`_TIEMPO_LIMITE_HORAS`**: umbrales **en horas** para comparar contra promedios o duraciones del timeline (alertas para el agente administrativo / ZYMO).

| Transición (etiqueta en código) | Límite (h) |
|---------------------------------|------------|
| `nueva → en_cotizacion` | 4 |
| `en_cotizacion → pendiente_aprobacion` | 48 |
| `pendiente_aprobacion → aprobada` | 24 |
| `aprobada → oc_enviada` | 8 |
| `oc_enviada → oc_en_plataforma` | 24 |
| `oc_en_plataforma → cerrada` | 168 (7 días) |

**Nota:** En el timeline real, la primera fila puede mostrarse como `inicio → {estado_nuevo}` según si hay `estado_anterior`; los límites anteriores aplican a las claves `estado → estado` que coincidan exactamente con el diccionario.

La función **`ver_tiempos_proceso_oc`** agrega, sobre las últimas **N** solicitudes (orden `updated_at`), promedios **en horas** por cada cadena de transición observada en el historial (`promedios_horas`) y lista **`alertas_tiempo`** cuando un promedio supera esos límites.

---

## 6. SLA en la lista de solicitudes (solo UI)

En **`SolicitudesPage`** (tabla del auxiliar de compras), el **SLABadge** **no** usa los límites del `oc_tools` ni las fechas de cotización/aprobación. Es un **indicador paralelo** basado solo en:

- **`fecha_solicitud`**
- **`nivel_prioridad`**: Alta = 4 h, Media = 24 h, Baja = 72 h
- **Estados activos para SLA**: `nueva`, `en_cotizacion`, `pendiente_aprobacion`, `aprobada`

Muestra horas restantes o horas vencidas respecto a ese reloj único desde la solicitud. Es **orientativo en listado**, no el mismo criterio que el KPI “promedio cotización” ni que los límites por etapa del agente.

---

## 7. Qué **no** mide este módulo (alcance)

- No hay cronómetro unificado de “lead time end-to-end” publicado como un solo número en KPI (sí se puede inferir sumando timeline o diferencia `fecha_solicitud` ↔ `fecha_cerrado` en análisis ad-hoc).
- **Módulo Financiero** (facturas, validaciones) tiene sus propios tiempos/ciclos; solo aparecen en compras los campos de factura mencionados arriba si se capturan en la solicitud.
- Correos automáticos pueden usar fechas en zona horaria Colombia para **texto de email**; eso no cambia el almacenamiento UTC típico en BD para las zonas anteriores.

---

## 8. Bloque `reporte_tiempos` en `GET /api/oc/kpis`

Desde la alineación UI + agentes, la respuesta de KPI incluye **`reporte_tiempos`**:

| Campo | Uso |
|--------|-----|
| `texto_para_informe` | Párrafo en español listo para pegar en correos, actas o respuestas de agentes (demora hasta cotización, reprocesos, cola de aprobación). |
| `metricas[]` | Cada ítem tiene `etiqueta` (**Tiempo de proceso**), `subtitulo`, `valor`, `unidad`, `ayuda` (qué mide y cómo). |
| `generado_en_utc` | Marca temporal del informe. |
| `nota_metodologia` / `sugerencia_agentes` | Alcance de los datos y enlace lógico a `GET /api/oc/kpis/tiempos` (promedios por etapa en horas). |

En la intranet, **Dashboard KPIs** muestra dos tarjetas claras bajo «Tiempos del proceso» y un recuadro **«Texto para informes y agentes»** con botón **Copiar informe**.

---

## Referencias rápidas en código

| Qué | Dónde |
|-----|--------|
| Modelo de fechas de proceso | `backend/app/models/oc.py` — `SolicitudOC` |
| KPI promedios cotización / reproceso | `backend/app/routers/oc/kpis.py` |
| Endpoint timeline | `backend/app/routers/oc/solicitudes.py` — `GET .../tiempos` |
| Límites y timeline agregado | `backend/app/agents/tools/oc_tools.py` |
| Tarjetas KPI en UI | `frontend/src/pages/oc/KPIPage.tsx` |
| SLA lista compras | `frontend/src/pages/oc/SolicitudesPage.tsx` — `SLA_HORAS`, `calcularSLA` |

---

*Última revisión: 2026-05-14 — incluye `reporte_tiempos` en KPI y UI.*
