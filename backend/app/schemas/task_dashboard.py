from pydantic import BaseModel


class TaskFilters(BaseModel):
    fecha_desde: str | None = None
    fecha_hasta: str | None = None
    responsable_id: int | None = None
    estado: str | None = None
    etiqueta: str | None = None
    plataforma: str | None = None
    q: str | None = None
    sin_registro_hoy: bool = False


class TaskKpis(BaseModel):
    tareas_registradas: int
    horas_registradas: float
    completadas: int
    en_progreso: int
    bloqueadas: int
    usuarios_activos: int
    usuarios_sin_registro_hoy: int


class PersonTaskSummary(BaseModel):
    user_id: int
    nombre: str
    email: str
    tareas_totales: int
    horas: float
    completadas: int
    en_progreso: int
    bloqueadas: int
    ultima_actividad: str | None
    registro_hoy: bool
