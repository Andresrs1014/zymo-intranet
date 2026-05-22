# ROI y Valor de Negocio — Helix Zymo

> Este nodo le enseña al agente a hablarle a Andrea (y a la gerencia) sobre el valor económico de los proyectos del área.
> Ver también: [[subproyectos]] | [[metricas_y_kpis]] | [[preguntas_frecuentes_andrea]]

---

## Cómo pensar el ROI en el área de Desarrollo

El área de Desarrollo de Grupo ZYMO no solo hace código — genera valor económico medible. Cada subproyecto tiene un costo de inversión (tiempo del equipo + infraestructura) y un retorno esperado (ahorro operativo, ingresos adicionales, eficiencia). Helix captura esos números para que Andrea pueda justificarlos ante gerencia.

---

## Qué significa cada número

| Número | Qué es en la práctica |
|---|---|
| **Inversión estimada** | Cuánto cuesta desarrollar el proyecto (horas del equipo × tarifa + costos de herramientas) |
| **Retorno esperado** | Cuánto va a ahorrar o generar para la empresa (por año, o al término del proyecto) |
| **ROI %** | Si se invirtió $1, cuánto se recupera en valor. ROI 200% = se recupera 3 veces lo invertido |
| **Costo de ejecución** | Lo que realmente se gastó en actividades individuales |
| **Costo de optimización** | El ahorro que cada actividad genera (el impacto positivo) |

---

## Clasificación de proyectos (para hablarle a gerencia)

| Clasificación | ROI | Qué decirle al gerente |
|---|---|---|
| **Alto potencial** | > 50% | "Este proyecto paga más del doble de lo que cuesta. Prioridad alta." |
| **Potencial favorable** | 20–50% | "Buen retorno. Vale la pena terminarlo este trimestre." |
| **Retorno controlado** | 0–20% | "Rentable pero ajustado. Evaluar si hay iniciativas más estratégicas." |
| **Revisar alcance** | ≤ 0% | "No está generando retorno con el alcance actual. Hay que redefinirlo." |

---

## Respuestas tipo sobre ROI

### "¿Cuánto vale el proyecto Helix Zymo?"
```
Helix Zymo:

Inversión estimada: $3,800,000 COP
Retorno esperado: $10,600,000 COP (eficiencia operativa anualizada)
ROI estimado: 179% → Potencial favorable ✅

Avance actual: 71% completado
A este ritmo, el retorno debería materializarse en julio 2026.
```

---

### "¿Cuál proyecto le conviene más a la empresa ahora mismo?"
```
Por ROI estimado:

1. Automatización reportes OC — ROI 320% (Alto potencial)
   → Ya está 90% terminado. Prácticamente el retorno ya está garantizado.

2. Helix Zymo — ROI 179% (Potencial favorable)
   → 71% completado. Recomendable terminar antes del cierre del trimestre.

3. Módulo financiero v2 — ROI 40% (Retorno controlado)
   → Útil pero no urgente si hay que priorizar recursos.
```

---

### "¿Estamos dentro del presupuesto?"
```
Helix Zymo:
Presupuesto estimado: $3,800,000
Costo ejecutado hasta hoy: $2,100,000 (actividades cerradas)
Actividades pendientes: 4 (costo estimado ~$1,200,000)

Estimado total: ~$3,300,000 → 13% por debajo del presupuesto ✅
```

---

## Lo que el agente NO puede afirmar sobre ROI

- No puede garantizar que el retorno se va a materializar — es una estimación del área
- No conoce el presupuesto total de la empresa ni la comparación con otros departamentos
- Los costos que ve son los que el equipo registró manualmente en Helix — no son datos contables oficiales
- Si el gerente pide cifras formales, debe ir al módulo financiero de la intranet

---

*Última actualización: 2026-05-22 | Fuente: `roiService.ts` + campos de costo en actividades Helix*
