# Proforma / anticipo en el flujo OC

## Cuándo se gestiona desde Compras (pantalla detalle OC)

- Debe existir **al menos una cotización cargada** en la solicitud.
- La solicitud **no** debe estar en estado: `oc_enviada`, `oc_en_plataforma`, `entregada`, `cerrada` o `cancelada`.

## Etapas posteriores al envío al proveedor

- La **descarga desde rutas OC** (`GET /api/oc/solicitudes/{id}/proforma/descargar`) responde 403.
- La descarga autorizada está en **Financiero**: `GET /api/financiero/facturas/{solicitud_id}/proforma` (permiso financiero).

## Implementación de referencia

- Reglas centrales: `backend/app/services/oc_proforma.py`
- Validación HTTP: `backend/app/routers/oc/solicitudes.py` (patch, upload, descarga)
- Condición de UI: `frontend/src/lib/ocProforma.ts`

## PDF de orden de compra (proveedor)

En `backend/app/routers/oc/documentos.py` (`_generar_pdf`), la sección **Nota** del template `template_oc.html` usa únicamente `observaciones_solicitante`. Las observaciones de la cotización (`oc_cotizaciones.observaciones`, uso interno en el flujo auxiliar/aprobación) no se incluyen en el PDF enviado al proveedor.
