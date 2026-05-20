from datetime import date, datetime

from pydantic import BaseModel


class TaskFilters(BaseModel):
    fecha_desde: date | None = None
    fecha_hasta: date | None = None
    responsable_id: int | None = None
    estado: str | None = None
    etiqueta: str | None = None
    plataforma: str | None = None
    q: str | None = None
    sin_registro_hoy: bool = False
    #: Día local del cliente (YYYY-MM-DD) para “registro hoy” y KPIs; si no llega, usa date.today() del servidor.
    fecha_referencia: date | None = None
    team_id: int | None = None


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
    ultima_actividad: datetime | None
    registro_hoy: bool
