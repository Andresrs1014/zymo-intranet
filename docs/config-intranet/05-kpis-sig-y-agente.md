# KPI del SIG: qué se tiene en cuenta y cómo los lee el agente

Estado: 2026-10-15 (local, sin desplegar).

## Fuente

Hojas de vida de indicadores FR-010-GER que cargan los líderes de proceso (Excel `.xlsx`), en
`C:\Gestion_documental\Procedimientos\procedimientos_nuevos\indicadores-kpis`. Hoy son 19 archivos y **41 fichas**:

| Carpeta | Archivos | Fichas | Observación |
|---|---|---|---|
| `Administrativo` | 9 | 12 | Compras, mantenimiento, mensajería, proveedores |
| `SIG` | 4 | 16 | SG-SST (IMC CARGO y LOGIMAT: mismos 6 indicadores en cada empresa), capacitaciones, plan de trabajo |
| `tyc` | 6 | 13 | Contratación, cierre financiero, incapacidades, periodos de prueba, selección |

Un archivo puede traer varias fichas (una por empresa o por hoja). Hay 5 indicadores semestrales y 2 anuales sin resultados
todavía, y el resto es mensual. El `ACTA PLAN DE ACCION INDICADORES AMINISTRATIVO.pdf` de la carpeta no se carga: es un acta.

## Qué guarda el SIG de cada ficha (`SigIndicador`)

Nombre, código, objetivo, fórmula, meta, frecuencia, fuente, tipo, tendencia, plazo, proceso responsable, versión y fecha del
documento, y los **resultados por periodo** (numerador, denominador, resultado, y la matriz de acciones de la hoja: lectura,
tipo de acción, acción, cierre, líder). Cada ficha queda en su área del SIG; la llave es **área + nombre + archivo** (antes era
área + nombre y la ficha de LOGIMAT pisaba la de IMC CARGO: se perdían 6 indicadores).

## Cómo se lee la meta y el estado

`sig-backend/src/services/indicadorLectura.ts` (espejo en `frontend/src/lib/sigIndicadores.ts`):

- La meta se convierte a número: `≥ 95%`, `≤ 2,5%`, `0.95` (razón), `100% de las contrataciones…`, `0`. Un número mayor que 1 **sin %** (`3 reportes`) queda «sin meta numérica»: no se inventa la unidad. Si la meta trae `≥`/`≤` manda; si no, manda la tendencia (descendente = `≤`).
- **Cumple** si el resultado alcanza la meta; **cerca** si está a menos del 10 % (≥) o hasta 25 % por encima (≤); **no cumple** en otro caso.

## Los hechos que revisa el agente (rúbrica §1.6)

El backend calcula, para cada indicador, estos datos mecánicos (`evaluacion`). Son **hechos de la hoja**: el agente decide si hay
hallazgo y los datos son autorreportados por los líderes.

| Dato | Qué responde | Regla de la rúbrica |
|---|---|---|
| `periodosSinResultado` | Periodos sin resultado entre el primero y el último medido, según la frecuencia | Completitud |
| `periodosPendientesHastaHoy` | Periodos vencidos desde el último medido | Completitud |
| `rachaSinCumplir` | Cuántos de los últimos resultados seguidos no cumplen | Tendencia (≥ 2 se muestra como alerta) |
| `incumplimientosSinAccion` | Periodos que no cumplen y no traen acción ni cierre (marcar «no aplica» no cuenta como acción) | Resultado frente a meta |
| `sinNingunResultado` | La hoja no trae ningún resultado (no se inventan periodos vencidos) | Completitud |
| `noCoincideConNumeradorDenominador` | Resultado que no sale de numerador ÷ denominador (puede ser un indicador inverso) | Reproducibilidad |
| `valoresFueraDeRango` | Negativos o mayores a 100 % | Consistencia |
| `definicionIncompleta` | Campos vacíos: objetivo, fórmula, meta, frecuencia, fuente, responsable | Definición |

Si la hoja no trae numerador y denominador, el agente **no recalcula ni estima**.

Ejemplo real: en «Reporte de períodos de prueba» (IMC CARGO y LOGIMAT) la hoja reporta 3 entregados de 2 requeridos y un resultado de 66,7 %: el resultado no sale de numerador ÷ denominador. Es un dato inconsistente de la hoja, no un error del lector, y el agente lo verá como hecho.

## Dónde se ve

- **Intranet** (SIG → Indicadores): resumen por estado, filtro «Con puntos por revisar», y en cada ficha el bloque «Lo que revisa el agente».
- **API**: `GET /sig-api/api/indicadores?areaId=` o `?procedimientoId=` (cada indicador trae `evaluacion`) y `GET /api/procedimientos/:id/review-context` (campo `indicadores`, los del área del procedimiento).
- **MCP `mcp001-intranet`**: herramienta `sig_list_indicators` (por procedimiento o por área) y el campo `indicadores` de `sig_review_context`. Los líderes de área y quien no tiene permiso de SIG NO ven los indicadores: la puerta (`gateLider`) cierra por defecto todo `/api` salvo `reportes-desarrollo`, decodifica la URL y no distingue mayúsculas (hubo una fuga con `/Indicadores` que se cerró el 2026-10-15), y Express enruta con `case sensitive routing`. Al MCP no viaja el nombre del líder de cada mes.

## Pendiente de decisión

- **Confidencialidad:** los textos libres de la matriz (`lectura`, `acción`) pueden traer nombres de personas y datos de salud (retiros, incapacidades por accidente de trabajo). El MCP los entrega a un agente externo (Codex/GPT) y la rúbrica §0 dice que los KPI no salen a servicios externos. Se quitó el campo `lider`; falta decidir si se recortan los textos libres o se declara la excepción en la rúbrica.

- Los indicadores se guardan por **área del SIG**, y las áreas nacen de las áreas de la intranet. Las carpetas de origen (`Administrativo`, `SIG`, `tyc`) no coinciden con ellas; en local se cargaron así: Administrativo → Compras, SIG → Gestión de Calidad, tyc → Talento y Cultura. Hay que confirmar el área definitiva de cada carpeta antes de cargar en producción.
- El vínculo indicador ↔ procedimiento es por área (no hay un campo «proceso» que los una uno a uno).
