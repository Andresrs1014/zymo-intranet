# MEMORIA — Deuda técnica y bugs conocidos
**Proyecto:** ZYMO Intranet  
**Última actualización:** 2026-04-27 (revisión despliegue)

Este archivo registra bugs conocidos, deuda técnica y mejoras pendientes que se detectaron durante la implementación pero que no bloquean el flujo principal. Se revisa al final de cada ciclo de implementación.

---

## ✅ Revisión de despliegue — 2026-04-27

Se realizó revisión completa de todos los cambios para verificar que son desplegables con `docker compose up --build`. Resultado: **listo para despliegue**.

### Hallazgos corregidos en la revisión:
| # | Hallazgo | Corrección |
|---|----------|-----------|
| R1 | `OcConfigPage` inicializaba `listasForm` sin `placas` → error TypeScript | Agregado `placas: []` al estado inicial |
| R2 | `lista_placas` no tenía UI de edición en OcConfigPage | Agregado `ListaEditor` para placas en la sección de Listas |
| R3 | `email_contabilidad` no tenía campo en la UI de Configuración (DT-006) | Agregado `Field` en sección Destinatarios |
| R4 | `.env.example` no incluía `ENVIRONMENT` → en servidor quedaba en "development" | Agregado `ENVIRONMENT=production` al template |

### Checklist de despliegue confirmado:
- [x] Migraciones retrocompatibles: columnas nuevas con DEFAULT, no rompen registros existentes
- [x] Solicitudes creadas por webhook (Power Automate) quedan con `tipo_solicitud="compra"` por default
- [x] `SolicitudRead` expone los 3 campos nuevos al frontend
- [x] Frontend TypeScript compila sin errores de linter
- [x] Docker Compose: `backend_data` volumen persiste `oc.db`; la migración corre en startup
- [x] `ENVIRONMENT` debe estar en `.env` del servidor como `production`
- [x] Email OC: proveedor + solicitante en el mismo correo (sin duplicado)
- [x] Toggle proforma usa `require_compras` — solo usuarios de compras lo pueden cambiar

---

## 🐛 Bugs conocidos

### BUG-001 — Módulo Financiero muestra valores en dólares en vez de COP
**Detectado:** 2026-04-27  
**Impacto:** Alto — afecta la validación contable de facturas  
**Descripción:** El módulo financiero toma los valores de cotización/OC y los interpreta en dólares, pero las cotizaciones vienen en pesos colombianos (COP). El error puede estar en el formato numérico al leer desde la BD o en la lógica de conversión del DTO.  
**Archivos sospechosos:** `backend/app/routers/financiero/facturas.py`, `frontend/src/pages/financiero/FacturaDetallePage.tsx`  
**Estado:** ⏸ Pendiente — no bloquea el flujo actual porque el módulo no está en uso aún. Atacar antes del go-live de contabilidad.

---

### BUG-002 — Factura en "En plataforma" puede ser obligatoria cuando debería ser opcional
**Detectado:** 2026-04-27  
**Impacto:** Medio — puede bloquear el avance del flujo si el sistema la exige  
**Descripción:** El documento de proceso define que adjuntar la factura al marcar "En plataforma" es opcional. Hay que verificar en el backend y en el frontend que no existe ninguna validación que la haga requerida.  
**Archivos a revisar:** `backend/app/routers/oc/documentos.py` (endpoint marcar_en_plataforma), `frontend/src/pages/oc/SolicitudDetallePage.tsx` (PanelOrdenCompra)  
**Estado:** ⏸ Pendiente verificación.

---

## 📋 Deuda técnica

### DT-001 — SLA de prioridad sin alertas automáticas
**Detectado:** 2026-04-27  
**Descripción:** Los tiempos de SLA (Alta=4h, Media=12-24h, Baja=72h) existen como etiquetas pero ningún proceso automático alerta al auxiliar cuando el tiempo está por vencerse. Requiere un job background que revise solicitudes cada N minutos.  
**Impacto:** Bajo en operación actual, alto en seguimiento gerencial.  
**Estado:** 📌 Planificado para después del go-live inicial.

### DT-002 — GET /roles expuesto a cualquier usuario autenticado
**Detectado:** 2026-04-26  
**Descripción:** Solucionado en Paso 1 de seguridad (2026-04-26).  
**Estado:** ✅ Resuelto.

### DT-003 — Dashboard KPIs básico — necesita gráficas del proceso completo
**Detectado:** 2026-04-27  
**Descripción:** La página de KPIs existe pero es básica. El proceso requiere: solicitudes activas por estado, tiempo promedio en cada etapa, proveedores más frecuentes, registro de compra vs mantenimiento en los datos.  
**Prioridad:** Media — construir cuando los datos nuevos (tipo_solicitud) estén bien capturados.  
**Estado:** ⏸ Pendiente.

### DT-004 — Rol "operaciones" en frontend sin par en _DEFAULT_ROLES del backend
**Detectado:** 2026-04-26  
**Descripción:** `permissions.ts` referencia un rol `"operaciones"` que no está en los roles sembrados del backend. Puede ser un rol creado manualmente en algún entorno.  
**Estado:** ⏸ Verificar en producción y alinear si es necesario.

### DT-005 — require_any_role() definido en deps.py pero nunca usado
**Detectado:** 2026-04-26  
**Descripción:** Guard genérico y reutilizable que no tiene usos. En el Paso 6 de seguridad se planificó consolidar listas de roles duplicadas usando este helper.  
**Estado:** ⏸ Planificado en Paso 6 del roadmap.

### DT-006 — OcConfig frontend — campo email_contabilidad sin UI de edición
**Detectado:** 2026-04-27  
**Descripción:** Se agregó `email_contabilidad` al sistema OcConfig en el backend pero la página de configuración frontend no tenía el campo visible para editarlo.  
**Estado:** ✅ Resuelto en revisión de despliegue 2026-04-27.

### DT-007 — Checks de rol inline en SolicitudDetallePage (esAprobador, esAdmin)
**Detectado:** 2026-04-26  
**Descripción:** La página usa checks inline ad-hoc en lugar de las funciones centralizadas de `lib/permissions.ts`. Esto crea riesgo de desincronización si los roles cambian.  
**Estado:** ⏸ Planificado en Paso 6 del roadmap.

---

## 💡 Mejoras identificadas pero no prioritarias

### MEJ-001 — Indicador de cuántas cotizaciones presentó el auxiliar
El proceso permite 1 o 3 cotizaciones. Agregar una pregunta al momento de enviar a aprobación: "¿Presentaste más cotizaciones además de esta?" con campo numérico. Dato valioso para KPIs.

### MEJ-002 — Correo de recordatorio SLA vencido
Si una solicitud Alta supera 4h sin cotización, enviar recordatorio al auxiliar. Requiere job background (Celery o FastAPI background task programado).

### MEJ-003 — Matching inteligente de proveedores en cotización
Al escribir el nombre del proveedor en la cotización, sugerir los proveedores activos de SGC. Si el NIT no coincide con ninguno registrado, marcar automáticamente como "proveedor nuevo" y enviar correo a SGC.

---

## ✅ Implementado en esta sesión (2026-04-27)

| ID | Descripción | Estado |
|----|-------------|--------|
| P2A | Modelo: `tipo_solicitud`, `tipo_mantenimiento`, `tiene_proforma` + migraciones | ✅ |
| P2B | OcConfig: `lista_placas` administrable desde configuración (backend + UI) | ✅ |
| P2C | Frontend: NuevaSolicitudPage con bifurcación compra/mantenimiento | ✅ |
| P2D | Frontend: vistas detalle muestran tipo_solicitud y campos mantenimiento | ✅ |
| P2E | Email: mismo correo a solicitante + proveedor (sin duplicado) | ✅ |
| P2F | Anticipo: toggle `tiene_proforma` visible durante todo el proceso | ✅ |
| R3 | OcConfigPage: UI para email_contabilidad | ✅ |
| R4 | .env.example: variable ENVIRONMENT documentada | ✅ |

---

## 📝 Decisiones de diseño registradas

| Fecha | Decisión |
|-------|----------|
| 2026-04-27 | Mantenimiento y Compra son tipos de solicitud SEPARADOS desde el formulario. No pueden ir juntas. |
| 2026-04-27 | La lista de placas/montacargas va en OcConfig (mismo sistema que lista_clientes), no en tabla separada. |
| 2026-04-27 | Anticipo/Proforma: toggle visible en todo momento del proceso, no un estado nuevo. Campo `tiene_proforma` en la solicitud. |
| 2026-04-27 | Email al enviar OC: solicitante y proveedor reciben EL MISMO correo (ambos como destinatarios), no correos separados. |
| 2026-04-27 | 3 cotizaciones son opcionales, pero si hay más de una, el gerente puede ver la comparativa. |
| 2026-04-27 | Proveedor "nuevo" = NIT de la cotización no existe en la BD de proveedores SGC. |
| 2026-04-26 | email_contabilidad se configura desde OcConfig (UI de configuración OC), no desde .env. |
