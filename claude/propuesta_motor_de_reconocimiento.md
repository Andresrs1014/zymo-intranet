# Blueprint: Sistema Inteligente de Extracción y Generación de OC (Intranet/CRM)

Este documento define la lógica de negocio y técnica para automatizar la creación de Órdenes de Compra (OC) a partir de documentos externos (Cotizaciones).

---

## 1. Arquitectura de Datos y Pipeline
El sistema debe procesar archivos heterogéneos y centralizar la información en el CRM mediante el siguiente flujo:

### Fase I: Ingesta Multiformato
* **Extractores:** Implementar wrappers sobre `pdfplumber` (PDF), `pandas` (Excel) y `python-docx` (Word).
* **Normalización de Texto:** Limpieza de caracteres especiales, eliminación de espacios en blanco redundantes y estandarización de codificación (UTF-8).
* **Detección de Tablas:** Priorizar la extracción de filas de productos/servicios, cantidades y precios unitarios.

### Fase II: Motor de Mapeo (Mapping Engine)
Para manejar variantes de nombres (ej: "Valor Total" vs "Costo Final"), se utilizará un enfoque híbrido:
1.  **Hard-Mapping:** Diccionario de sinónimos predefinidos en la base de datos (MySQL/Postgres).
2.  **Fuzzy Matching:** Uso de `TheFuzz` para calcular similitud de strings con un umbral (threshold) del >85%.
3.  **Semantic Mapping (LLM):** Enviar el texto extraído a la API de Claude para clasificar campos ambiguos basándose en el contexto del documento.

### Fase III: Validación y Persistencia
* **Esquema Pydantic:** Validación estricta de tipos de datos antes de la inserción en el CRM.
* **Interfaz de Ajuste:** Front-end reactivo que permita al usuario reordenar o corregir campos mapeados incorrectamente.
* **Audit Log:** Guardar el archivo original relacionado con el registro de la OC generado en el sistema de archivos de la intranet.

---

## 2. Lógica de Integración con Claude API
Cuando el script de Python no logre mapear un campo con certeza, se delegará la interpretación a la API de Claude mediante un prompt estructurado:

**Estrategia de Prompting (System Prompt):**
> "Actúa como un experto en logística y compras. Se te entregará el texto extraído de una cotización. Tu objetivo es devolver un objeto JSON estricto con las siguientes llaves: `proveedor`, `nit`, `items` (lista de objetos con `descripcion`, `cantidad`, `precio_unitario`), `moneda` y `total_final`. Si un campo es ambiguo, utiliza tu capacidad de razonamiento para deducirlo por el contexto."

---

## 3. Consideraciones Técnicas para la Implementación (Contexto Dev)

### Stack Recomendado:
* **Backend:** Python (Django/FastAPI para la integración con la Intranet).
* **Base de Datos:** Tabla `mapping_translations` para almacenar pares (Termino_Encontrado -> Termino_Canonico) y mejorar la precisión con el tiempo.
* **Seguridad:** Procesamiento local de documentos sensibles antes de enviar solo el texto necesario a la API externa.

### Gestión de Errores y "Reacomodo":
* El sistema debe generar un **"Score de Confianza"**. Si la confianza es menor al 90%, el sistema bloquea la aprobación automática y requiere revisión manual en la UI de la Intranet.
* Cada corrección manual debe alimentar la tabla de `mapping_translations` para auto-entrenar la lógica de búsqueda local.

---

## 4. Próximos Pasos para Claude Code
1.  **Módulo de Parsing:** Crear scripts base para lectura de PDF con `pdfplumber`.
2.  **Módulo de Mapeo:** Implementar lógica de comparación de strings con `TheFuzz`.
3.  **Módulo de API:** Configurar el cliente de Anthropic para validación de datos no estructurados.
4.  **Integración CRM:** Crear los endpoints de API que reciban el JSON validado y creen el registro en la tabla de Órdenes de Compra.