# Plan Fase 2 — Vision API para análisis de PDFs con imágenes

**Fecha de creación:** 2026-06-17
**Estado:** PENDIENTE — listo para ejecutar
**Contexto previo:** Fase 1 completada (commit `142c149`) — el `flujogramaMmd` ya se incluye en el contexto de análisis.

---

## Problema que resuelve

pdfjs-dist extrae solo texto de los PDFs (`page.getTextContent()`). Las imágenes, capturas de pantalla, tablas visuales y flujogramas incrustados en el PDF son invisibles para Claude. Esta fase permite renderizar cada página del PDF como imagen JPEG y enviárselas a Claude junto al texto, usando la Vision API multimodal.

**Qué mejora:**
- Procedimientos con capturas de pantalla de sistemas (SAP, ERP)
- Documentos con tablas visuales no parseables como texto
- PDFs escaneados donde el texto extraído es incompleto
- Flujogramas en formato imagen (no Mermaid)

**Alcance:** Solo aplica a `net_file_manager` (carga desde archivo). La intranet ya tiene Fase 1 (flujogramaMmd). No hay cambio de BD.

---

## Arquitectura del cambio

```
ANTES:
PDF → pdfjs-dist.getTextContent() → texto plano → Claude (texto)

DESPUÉS:
PDF → pdfjs-dist.getTextContent() → texto plano ┐
    → pdfjs-dist.page.render() → canvas → JPEG  ┘ → Claude (texto + imágenes)
```

El campo `images` es **opcional** en todos los endpoints — si no se envía, el comportamiento es idéntico al actual. No hay breaking change.

---

## Archivos a modificar

### 1. `C:\net_file_manager\src\services\documentService.ts`

**Agregar función** `extractPageImages`:

```typescript
export interface PageImage {
  data: string;       // base64 puro, SIN prefijo "data:..."
  mediaType: 'image/jpeg';
  pageNumber: number;
}

export async function extractPageImages(
  filePath: string,
  options: { maxPages?: number; scale?: number; quality?: number } = {},
): Promise<PageImage[]> {
  const { maxPages = 8, scale = 1.5, quality = 0.75 } = options;

  const rawData = await window.electronAPI.readFile(filePath);
  const uint8Data = rawData instanceof Uint8Array
    ? rawData
    : new TextEncoder().encode(rawData as string);

  const pdf = await pdfjs.getDocument({ data: uint8Data }).promise;
  const pagesToRender = Math.min(pdf.numPages, maxPages);
  const images: PageImage[] = [];

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // OffscreenCanvas: disponible en Electron renderer (Chromium)
    const canvas = new OffscreenCanvas(
      Math.floor(viewport.width),
      Math.floor(viewport.height),
    );
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const arrayBuffer = await blob.arrayBuffer();
    // Convertir a base64 en chunks para evitar stack overflow en páginas grandes
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK = 8192;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
    }
    images.push({ data: btoa(binary), mediaType: 'image/jpeg', pageNumber: i });
  }

  return images;
}
```

**Tamaño esperado:** ~300–600 KB base64 por página A4 con scale 1.5 y quality 0.75.  
**Límite:** 8 páginas máximo → ~4 MB de imágenes en el peor caso.

**Fallback si OffscreenCanvas falla** (por si acaso):
```typescript
// Alternativa con canvas del DOM (solo si hay document disponible):
const canvas = document.createElement('canvas');
// ... mismo flujo, canvas.toBlob() en lugar de convertToBlob()
```

---

### 2. `C:\net_file_manager\src\components\sig\SigAnalisisPanel.tsx`

**Cambio en `loadTextContent()`** → renombrar y expandir a `loadDocumentForAnalysis()`:

```typescript
interface DocumentPayload {
  text: string;
  images: PageImage[];  // vacío para MD/TXT
}

const loadDocumentForAnalysis = async (): Promise<DocumentPayload | null> => {
  const strip = (t: string) =>
    t.replace(/!\[[^\]]*\]\(data:[^)]{8,}\)/g, '[imagen eliminada]');

  let filePath: string | null = null;
  let rawText: string;

  if (cachedMd) {
    try {
      const raw = await ipc().readFile(cachedMd.path);
      rawText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array);
      filePath = cachedMd.path;
    } catch {
      setCachedMd(null);
      localStorage.removeItem(`sig-md-${proc.id}`);
      filePath = null;
      rawText = '';
    }
  }

  if (!filePath) {
    try {
      const path = await ipc().openFileDialog?.([
        { name: 'Documentos', extensions: ['md', 'txt', 'pdf'] },
      ]);
      if (!path) return null;
      filePath = path;
      const raw = await ipc().readFile(path);
      rawText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array);
    } catch {
      return null;
    }
  }

  // Extraer imágenes del PDF si aplica
  let images: PageImage[] = [];
  if (filePath.toLowerCase().endsWith('.pdf')) {
    try {
      images = await extractPageImages(filePath, { maxPages: 8, quality: 0.75 });
    } catch (err) {
      console.warn('[SIG] No se pudieron extraer imágenes del PDF:', err);
      // No fallar — continuar sin imágenes
    }
  }

  return { text: strip(rawText), images };
};
```

**Actualizar cada `start*` function** para desestructurar y pasar imágenes:
```typescript
// Antes:
const text = await loadTextContent();
if (!text) { ... }
const res = await triggerAnalisisCoherencia({ ..., textContent: text });

// Después:
const doc = await loadDocumentForAnalysis();
if (!doc) { ... }
const res = await triggerAnalisisCoherencia({
  ...,
  textContent: doc.text,
  images: doc.images,   // ← nuevo campo opcional
});
```

---

### 3. `C:\net_file_manager\src\services\sigCommitService.ts`

**Agregar tipo** y actualizar funciones trigger:

```typescript
export interface PageImagePayload {
  data: string;
  mediaType: 'image/jpeg';
}

export interface TriggerCoherenciaPayload {
  procedimientoId: number;
  procedureCode:   string;
  area:            string;
  textContent:     string;
  systemPrompt?:   string;
  images?:         PageImagePayload[];   // ← nuevo campo opcional
}
// (misma adición para TriggerMejorasPayload, TriggerProcVsInstPayload, TriggerCargosPayload)
```

No hay más cambio — el cuerpo de las funciones simplemente pasa el payload completo al POST.

---

### 4. `C:\zymo-intranet\backend\app\routers\netvault.py`

#### 4a. Agregar modelo `ImageInput`

```python
class ImageInput(BaseModel):
    data: str = Field(..., max_length=10_000_000)  # ~7.5MB base64 → ~5.6MB binario
    mediaType: str = Field(default="image/jpeg", pattern=r"^image/(jpeg|png|gif|webp)$")
```

Ubicar después de `_strip_base64_blobs` y antes de `AnalyzeRequest`.

#### 4b. Agregar campo `images` a los 4 modelos SIG

```python
class CoherenciaRequest(BaseModel):
    ...
    images: list[ImageInput] = Field(default_factory=list, max_length=8)

class MejorasRequest(BaseModel):
    ...
    images: list[ImageInput] = Field(default_factory=list, max_length=8)

class ProcVsInstRequest(BaseModel):
    ...
    images: list[ImageInput] = Field(default_factory=list, max_length=8)

class CargosRequest(BaseModel):
    ...
    images: list[ImageInput] = Field(default_factory=list, max_length=8)
```

`IndexarLightRAGRequest` NO necesita imágenes (solo indexa texto en el grafo).

#### 4c. Agregar helper `_build_multimodal_content`

```python
def _build_multimodal_content(
    text: str,
    images: list[ImageInput],
) -> str | list[dict[str, Any]]:
    """
    Retorna text plano si no hay imágenes (compatible con Claude API existente),
    o una lista de content blocks multimodal si las hay.
    Las imágenes van PRIMERO para que Claude las vea antes del prompt textual.
    """
    if not images:
        return text
    content: list[dict[str, Any]] = []
    for img in images:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": img.mediaType,
                "data": img.data,
            },
        })
    content.append({"type": "text", "text": text})
    return content
```

#### 4d. Actualizar cada `_run_*_job` para usar multimodal

**Patrón en los 4 jobs (coherencia, mejoras, pvsi, cargos):**

```python
# Antes (línea ~630):
messages=[{"role": "user", "content": _build_coherencia_user(body)}],

# Después:
user_text = _build_coherencia_user(body)
content   = _build_multimodal_content(user_text, body.images)
messages=[{"role": "user", "content": content}],
```

#### 4e. Actualizar system prompts para mención de imágenes

En `_build_coherencia_system()` y `_build_mejoras_system()`, agregar al final:

```python
# Agregar esta línea en el string del system prompt:
"Si se incluyen imágenes de las páginas del documento, analízalas en el contexto del procedimiento e integra los hallazgos visuales (capturas, tablas, flujogramas) en tu evaluación."
```

---

### 5. Nginx — límite de body (verificar antes de ejecutar)

Los payloads con imágenes pueden alcanzar ~4–5 MB. Verificar `client_max_body_size` en nginx:

```bash
# En el servidor:
grep -r "client_max_body_size" /etc/nginx/
```

Si está por debajo de 20 MB, actualizar en el bloque `location /api/`:
```nginx
client_max_body_size 20M;
```

Archivo: `docker/nginx/nginx.conf` o equivalente en el repositorio.

---

## Orden de ejecución

```
Paso 1 — net_file_manager/documentService.ts
         Agregar extractPageImages()
         Verificar en Electron que OffscreenCanvas funciona
         (test manual: cargar un PDF y logear el array de imágenes)

Paso 2 — net_file_manager/SigAnalisisPanel.tsx
         Cambiar loadTextContent → loadDocumentForAnalysis
         Actualizar los 4 start* functions

Paso 3 — net_file_manager/sigCommitService.ts
         Agregar campo images? a los 4 payloads

Paso 4 — backend/app/routers/netvault.py
         Agregar ImageInput, campo images a modelos, helper _build_multimodal_content
         Actualizar los 4 _run_*_job

Paso 5 — Verificar nginx client_max_body_size
         Si está bajo, actualizar docker/nginx/nginx.conf

Paso 6 — tsc --noEmit en frontend y net_file_manager
         docker compose up --build -d backend
         Prueba manual con procedimiento que tenga capturas
```

---

## Restricciones Claude Vision (no superar)

| Límite | Valor |
|--------|-------|
| Tamaño máximo por imagen (base64) | ~6.7 MB (5 MB binario) |
| Imágenes por request | 20 max (nosotros usamos 8) |
| Tipos aceptados | jpeg, png, gif, webp |
| Tokens por imagen 1568px | ~1600 tokens |
| Costo adicional por 8 páginas | ~$0.04–0.10 por análisis |

---

## Lo que NO cambia

- La API key sigue en el backend únicamente
- El patrón job asíncrono (POST → job_id → polling) no cambia
- La intranet web no toca este flujo (ya tiene flujogramaMmd de Fase 1)
- Los resultados se guardan en las mismas tablas de BD
- Docker-ready: solo `docker compose up --build -d backend` para el backend

---

## Decisiones de diseño pendientes (para acordar al ejecutar)

1. **¿Cuántas páginas máximo?** Plan dice 8. Para procedimientos muy largos podría ser insuficiente. Alternativa: las primeras 5 + la última.
2. **¿Scale 1.5?** A 1.5x una página A4 = ~1240×1754px ≈ 400KB JPEG. Si hay texto pequeño o tablas densas, scale 2.0 da mejor legibilidad pero duplica el peso.
3. **¿Extraer imágenes también en el `analizar` general** (AnalyzeRequest)? Por ahora el plan lo excluye (solo los 4 endpoints SIG).
