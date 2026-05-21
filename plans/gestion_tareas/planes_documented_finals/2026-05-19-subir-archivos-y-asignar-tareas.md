# Plan: Archivos Adjuntos y Asignar Tareas

**Fecha:** 2026-05-19
**Proyecto:** Gestión de Tareas - Intranet Zymo
**Estado:** Planificado

---

## 1. Resumen Ejecutivo

Se implementarán dos funcionalidades para el módulo de Gestión de Tareas:

1. **Adjuntos:** Permitir subir archivos a cada tarea con previsualización inline (PDF viewer, imagen).
2. **Asignación:** Cualquier usuario puede asignar una tarea a otro usuario del mismo equipo en cualquier momento.

---

## 2. Cambio #1: Archivos Adjuntos

### 2.1 Backend

#### Modelo de datos

**Archivo:** `backend/app/models/task_attachment.py`

```python
class TaskAttachment(SQLModel, table=True):
    __tablename__ = "task_attachments"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(index=True, nullable=False)

    filename: str = Field(max_length=255, nullable=False)
    file_path: str = Field(max_length=500, nullable=False)
    mime_type: str = Field(max_length=100, nullable=False)
    size_bytes: int = Field(nullable=False)

    uploaded_by_id: int = Field(index=True, nullable=False)
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
```

#### Esquemas

**Archivo:** `backend/app/schemas/task_attachment.py`

- `TaskAttachmentCreate` (para upload interno, no expuesto directamente)
- `TaskAttachmentRead`: modelo de respuesta
- `TaskAttachmentUploadResponse`: respuesta tras upload exitoso

#### Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/herramientas/tareas/{task_id}/adjuntos` | Subir archivo (multipart/form-data) |
| GET | `/api/herramientas/tareas/{task_id}/adjuntos` | Listar adjuntos de una tarea |
| GET | `/api/herramientas/tareas/adjuntos/{attachment_id}` | Servir archivo (Content-Disposition: inline para previews) |
| DELETE | `/api/herramientas/tareas/adjuntos/{attachment_id}` | Eliminar adjunto |

#### Lógica de negocio

1. **Upload:**
   - Validar tamaño máximo (ej: 10MB)
   - Validar tipos permitidos: `image/*`, `application/pdf`
   - Guardar en directorio `./uploads/tasks/{task_id}/`
   - Generar nombre único (UUID + extensión original)
   - Crear registro en BD

2. **Preview:**
   - PDF: endpoint retorna `Content-Type: application/pdf` con `Content-Disposition: inline`
   - Imagen: retorna el mime type original con `inline`
   - Otros: retornar con `attachment` (download)

#### Modificaciones existentes

- `backend/app/schemas/work_task.py`: agregar campo `adjuntos: list[TaskAttachmentRead]` a `WorkTaskRead`
- `backend/app/services/work_task_service.py`: función para cargar adjuntos al leer tarea

### 2.2 Frontend

#### Tipos

**Archivo:** `frontend/src/types/workTask.ts`

```typescript
export interface TaskAttachment {
  id: number
  task_id: number
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_by_id: number
  uploaded_at: string
}
```

#### Hooks

**Archivo:** `frontend/src/hooks/useTaskAttachments.ts`

- `useTaskAttachments(taskId)`: obtener lista de adjuntos
- `useUploadTaskAttachment()`: mutation para subir archivo
- `useDeleteTaskAttachment()`: mutation para eliminar

#### Componentes

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| `FileUploadZone` | `components/herramientas/tareas/FileUploadZone.tsx` | Dropzone con drag & drop |
| `AttachmentList` | `components/herramientas/tareas/AttachmentList.tsx` | Lista de archivos con iconos |
| `FilePreviewModal` | `components/herramientas/tareas/FilePreviewModal.tsx` | Modal con previsualización |

#### Integración en UI existente

1. **TaskForm.tsx:** Agregar sección de adjuntos (después de descripción)
2. **TaskDetailModal.tsx:** Mostrar lista de adjuntos + botón de subir
3. **FilePreviewModal:** Se abre al hacer click en el archivo:
   - PDF: `<iframe src={url} />` o usar `react-pdf`
   - Imagen: `<img src={url} />`

---

## 3. Cambio #2: Asignar Tarea a Otro Usuario

### 3.1 Backend

#### Modificaciones al modelo

**Archivo:** `backend/app/models/work_task.py`

Agregar campos:

```python
asignado_a_id: Optional[int] = Field(default=None, index=True)
asignado_a_nombre: Optional[str] = Field(default="", max_length=200)
```

#### Esquemas

**Archivo:** `backend/app/schemas/work_task.py`

Modificar `WorkTaskCreate` y `WorkTaskUpdate`:

```python
class WorkTaskCreate(BaseModel):
    # ... campos existentes ...
    asignado_a_id: Optional[int] = None

class WorkTaskUpdate(BaseModel):
    # ... campos existentes ...
    asignado_a_id: Optional[int] = None
```

Agregar `TaskAssignPayload`:

```python
class TaskAssignPayload(BaseModel):
    asignado_a_id: int
```

#### Endpoints existentes a modificar

| Endpoint | Cambio |
|----------|--------|
| `POST /api/herramientas/tareas` | Aceptar `asignado_a_id` |
| `PATCH /api/herramientas/tareas/{id}` | Aceptar `asignado_a_id` |
| `PATCH /api/herramientas/tareas/equipo/tareas/{id}` | Aceptar `asignado_a_id` |

#### Nuevo endpoint

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/herramientas/tareas/{task_id}/asignar` | Asignar tarea a usuario (acción rápida) |

#### Validaciones

- Solo usuarios con `tool_task_submit_dev` o `tool_task_manage_dev` pueden asignar
- El `asignado_a_id` debe ser miembro del mismo equipo (mismo `team_id` o workspace)
- Desnormalizar nombre del usuario asignado al momento de guardar

### 3.2 Frontend

#### Tipos

**Archivo:** `frontend/src/types/workTask.ts`

Modificar interfaces existentes:

```typescript
export interface WorkTask {
  // ... campos existentes ...
  asignado_a_id: number | null
  asignado_a_nombre: string | null
}

export interface WorkTaskCreate {
  // ... campos existentes ...
  asignado_a_id?: number
}

export interface WorkTaskUpdate {
  // ... campos existentes ...
  asignado_a_id?: number
}
```

#### Hooks

Los hooks existentes (`useCreateWorkTask`, `useUpdateWorkTask`) ya cubrirán el cambio si se agregan los campos a los tipos.

#### UI - Selector de usuario

**Opción A:** Agregar en `TaskForm.tsx` un combobox/select para elegir usuario del equipo.

**Opción B:** En `TaskDetailModal.tsx`, agregar botón "Asignar" que abre un modal con lista de usuarios.

#### Mostrar asignación

1. **TaskDataTable.tsx:** Agregar columna "Asignado a"
2. **TaskDetailModal.tsx:** Mostrar etiqueta "Asignado a: [nombre]" con opción de cambiar
3. **Mis tareas:** El filtro actual debería mostrar las tareas asignadas al usuario actual

---

## 4. Orden de Implementación Recomendado

```
Semana 1: Cambio #2 (Asignar tareas)
  ├── Backend: Modelo + schemas + endpoints
  ├── Frontend: Tipos + UI básica
  └── Testing: Asignar tareas entre usuarios

Semana 2: Cambio #1 (Archivos adjuntos)
  ├── Backend: Modelo + upload + serve
  ├── Frontend: Upload UI + Preview modal
  └── Testing: Subir PDF e imágenes
```

**Razón:** El cambio #2 es más simple y no requiere manejo de archivos. Permite validar el modelo de datos y la lógica de equipos antes de agregar complejidad con storage.

---

## 5. Dependencias Externas

| Dependencia | Uso | ¿Existe? |
|-------------|-----|----------|
| Directorio `./uploads/` en backend | Storage de archivos | No (crear) |
| react-pdf o similar | Preview de PDFs | No (evaluar) |
| react-dropzone | Upload UI | No (evaluar) |

---

## 6. Consideraciones de Seguridad

1. **Archivos:**
   - Validar MIME type del contenido, no solo del header
   - No permitir ejecución de archivos subidos
   - Limitar tamaño a 10MB por archivo

2. **Asignación:**
   - Verificar que el asignador tiene acceso al equipo del usuario asignado
   - Registrar en historial de actividad (ya existe `TaskActivityLog`)

---

## 7. Compatibilidad con Migraciones

El modelo `WorkTask` requiere migración de base de datos:

```sql
ALTER TABLE work_tasks ADD COLUMN asignado_a_id INT;
ALTER TABLE work_tasks ADD COLUMN asignado_a_nombre VARCHAR(200) DEFAULT '';

CREATE TABLE task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES work_tasks(id),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT NOT NULL,
    uploaded_by_id INT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
```

---

## 8. Critérios de Éxito

### Cambio #1 - Archivos
- [ ] Usuario puede subir archivo desde TaskForm
- [ ] Usuario puede ver lista de archivos en TaskDetailModal
- [ ] Click en PDF abre preview inline en navegador
- [ ] Click en imagen abre preview modal
- [ ] Usuario puede eliminar archivo
- [ ] Archivos se mantienen al editar tarea

### Cambio #2 - Asignación
- [ ] Al crear tarea, puedo seleccionar usuario del equipo
- [ ] Puedo cambiar asignación desde TaskDetailModal
- [ ] La columna "Asignado a" aparece en la tabla de tareas
- [ ] Cualquier usuario (con tool) puede asignar a cualquier otro del mismo equipo
- [ ] Historial registra la asignación

---

## 9. Archivos a crear/modificar

### Backend - Nuevos
- `backend/app/models/task_attachment.py`
- `backend/app/schemas/task_attachment.py`
- `backend/app/services/task_attachment_service.py`

### Backend - Modificar
- `backend/app/models/work_task.py`
- `backend/app/schemas/work_task.py`
- `backend/app/routers/herramientas_tareas.py`
- `backend/app/services/work_task_service.py`

### Frontend - Nuevos
- `frontend/src/hooks/useTaskAttachments.ts`
- `frontend/src/components/herramientas/tareas/FileUploadZone.tsx`
- `frontend/src/components/herramientas/tareas/AttachmentList.tsx`
- `frontend/src/components/herramientas/tareas/FilePreviewModal.tsx`

### Frontend - Modificar
- `frontend/src/types/workTask.ts`
- `frontend/src/hooks/useWorkTasks.ts`
- `frontend/src/components/herramientas/tareas/TaskForm.tsx`
- `frontend/src/components/herramientas/tareas/TaskDetailModal.tsx`
- `frontend/src/components/herramientas/tareas/TaskDataTable.tsx`

---

*Plan generado el 2026-05-19*