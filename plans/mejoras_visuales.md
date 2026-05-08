Listo pegue una nueva versión, lo importante es que captes la idea, adicional a eso, te voy a pasar un canvas que hizo gemini con el modulo de tareas de la intranet para que ajustes el plan a eso que es lo que quiero y veamos que logica hace falta en el backend igual le pedi que me diera lo que hiciera falta en el backend y me dio esto:

1. Endpoint Principal: Listado y Paginación (DataTable)
El frontend ya no consume toda la base de datos de golpe. Necesitamos un endpoint que soporte paginación real y filtros combinados.

GET /api/v1/herramientas/tareas

Query Parameters necesarios:

page (int, default: 1)

limit (int, default: 10)

search (string, opcional) -> Búsqueda con ILIKE en título y descripción.

responsable_id (int, opcional)

estado (string, opcional)

fecha_exacta (string YYYY-MM-DD, opcional) -> Vital para cuando hagamos clic en el calendario lateral.

Lógica Backend: El servicio (work_task_service.py) debe usar un select() base e ir agregando .where() dinámicamente según los parámetros que lleguen.

Respuesta esperada (Estructura Paginated):

JSON
{
  "data": [ { "id": 1, "titulo": "...", "estado": "en_progreso" } ],
  "meta": {
    "total_items": 124,
    "total_pages": 13,
    "current_page": 1,
    "limit": 10
  }
}
2. Endpoint de Métricas Rápidas (Los KPIs del Bento Grid)
No queremos calcular las 45 horas invertidas trayendo todas las tareas al frontend. El backend debe hacer el trabajo pesado (agregación SQL).

GET /api/v1/herramientas/tareas/kpis

Query Parameters: Los mismos filtros de arriba (si filtro por "Andrés", los KPIs deben recalcularse solo para Andrés).

Lógica Backend (task_dashboard_service.py):

COUNT(id) para el total de tareas.

SUM(tiempo_minutos) / 60 para las horas invertidas.

COUNT(DISTINCT responsable_id) para usuarios activos.

Retornar deltas (Ej: +12% vs semana anterior). Esto implica consultar también el rango de fechas anterior para comparar.

3. Endpoint para Agendar Tareas (El Panel Lateral "Sheet")
El nuevo formulario de agendamiento incluye campos de tiempo (hora inicio, duración).

POST /api/v1/herramientas/tareas

Payload (JSON) esperado desde el Frontend:

JSON
{
  "responsable_id": 14,
  "titulo": "Revisión de pull requests",
  "descripcion": "Detalles de lo que se debe realizar...",
  "fecha_programada": "2026-05-07",
  "hora_inicio": "09:00",
  "duracion_estimada_horas": 2.0
}
Lógica Backend:

Validar que el responsable_id exista.

Calcular el tiempo_estimado_minutos (duración * 60).

Guardar el estado inicial como pendiente o en_progreso (dependiendo de tu regla de negocio).

4. Endpoints para el Panel de Detalles (Tabs)
Cuando el usuario hace clic en "Ver Detalle", necesitamos la información completa y su historial.

GET /api/v1/herramientas/tareas/{id} -> Trae los detalles ricos (descripción larga).
GET /api/v1/herramientas/tareas/{id}/historial

Lógica Backend: Necesitas una tabla (o en su defecto, parsear JSON) que guarde los cambios de estado.

Ejemplo de respuesta para la Tab "Actividad":

JSON
[
  { "fecha": "2026-05-06T10:00:00Z", "accion": "creacion", "usuario": "Admin" },
  { "fecha": "2026-05-06T14:30:00Z", "accion": "cambio_estado", "detalle": "De pendiente a en_progreso" }
]
5. Endpoint de Usuarios/Responsables (Para los Combobox)
El select de responsables no puede estar hardcodeado.
GET /api/v1/users/equipo-desarrollo (o similar)

Debe devolver solo los usuarios activos que pertenecen al equipo o que tienen permisos para realizar tareas, con id, nombre y tal vez un avatar/iniciales para la UI.

Consideraciones Críticas de Arquitectura (Full-Stack)
El problema de las Fechas (Timezones): Como arquitecto te advierto: las fechas son el enemigo silencioso. Si el frontend envía 2026-05-07, asegúrate de que el backend en FastAPI (que usa Python datetime) lo interprete en la zona horaria de Colombia (UTC-5) y no lo guarde como el día anterior por diferencias de UTC. Estandariza todo usando strings ISO YYYY-MM-DD para fechas absolutas sin tiempo.

Optimización de Consultas (N+1): En work_task_service.py, cuando devuelvas la lista de tareas, asegúrate de usar .options(joinedload(WorkTask.responsable)) en SQLAlchemy/SQLModel. Si devuelves 10 tareas y haces una consulta extra por cada nombre de responsable, tu API será muy lenta.

Estados Globales vs Locales (Zustand + React Query):
En el frontend, para que la UI se sienta instantánea, usaríamos @tanstack/react-query. Cuando hagas el POST para agendar la tarea, React Query invalidará la caché del GET /tareas, forzando a la tabla y al calendario a actualizarse solos en segundo plano sin recargar la página.

Y el codigo del canvas es este:

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// 0. ESTILOS GLOBALES Y ANIMACIONES
// ============================================================================
const GlobalStyles = () => (
  <style>
    {`
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

      :root {
        --brand-red: #dc2626;
      }

      .font-roboto { font-family: 'Roboto', sans-serif; }

      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(15px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .animate-fade-in-up {
        animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
      }

      .delay-100 { animation-delay: 100ms; }
      .delay-200 { animation-delay: 200ms; }
      .delay-300 { animation-delay: 300ms; }
      
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      
      /* Toast Animation */
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .animate-slide-in-right {
        animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
    `}
  </style>
);

// ============================================================================
// 1. PRIMITIVOS DE UI (Estilo shadcn/ui)
// ============================================================================

const Card = ({ className, children }) => (
  <div className={`rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm flex flex-col ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ className, children }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

const CardTitle = ({ className, children }) => (
  <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
);

const CardDescription = ({ className, children }) => (
  <p className={`text-sm text-slate-500 ${className}`}>{children}</p>
);

const CardContent = ({ className, children }) => (
  <div className={`p-6 pt-0 flex-1 ${className}`}>{children}</div>
);

const Button = ({ variant = 'default', size = 'default', className, children, ...props }) => {
  const baseStyle = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    destructive: "bg-red-500 text-slate-50 hover:bg-red-500/90 shadow-sm",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 shadow-sm",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-100/80",
    ghost: "hover:bg-slate-100 hover:text-slate-900",
    link: "text-slate-900 underline-offset-4 hover:underline"
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Badge = ({ variant = 'default', className, children }) => {
  const baseStyle = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
    secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
    destructive: "border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80",
    outline: "text-slate-950 border-slate-200",
    
    // Variantes custom para estados
    success: "border-transparent bg-emerald-100 text-emerald-800",
    brandOutline: "border-red-200 text-red-700 bg-red-50"
  };

  return (
    <div className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const Input = ({ className, ...props }) => (
  <input
    className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Label = ({ className, children, ...props }) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
    {children}
  </label>
);

const Textarea = ({ className, ...props }) => (
  <textarea
    className={`flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Tabs = ({ defaultValue, children, className }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <div className={className} data-active-tab={activeTab}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({ children, className }) => (
  <div className={`inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 ${className}`}>
    {children}
  </div>
);

const TabsTrigger = ({ value, activeTab, setActiveTab, children }) => {
  const isActive = activeTab === value;
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${isActive ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-200/50 hover:text-slate-900'}
      `}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, activeTab, children, className }) => {
  if (activeTab !== value) return null;
  return (
    <div className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 ${className}`}>
      {children}
    </div>
  );
};

const Pagination = ({ className, children }) => (
  <nav role="navigation" aria-label="pagination" className={`mx-auto flex w-full justify-center ${className}`}>
    {children}
  </nav>
);

const PaginationContent = ({ className, children }) => (
  <ul className={`flex flex-row items-center gap-1 ${className}`}>
    {children}
  </ul>
);

const PaginationItem = ({ className, children }) => (
  <li className={className}>{children}</li>
);

const PaginationLink = ({ className, isActive, children, ...props }) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 w-10
      ${isActive ? "border border-slate-200 bg-white shadow-sm" : "hover:bg-slate-100 hover:text-slate-900"}
      ${className}`}
    {...props}
  >
    {children}
  </a>
);

const PaginationPrevious = ({ className, ...props }) => (
  <a
    aria-label="Go to previous page"
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 hover:bg-slate-100 hover:text-slate-900 gap-1 pl-2.5 ${className}`}
    {...props}
  >
    <Icons.ChevronLeft className="h-4 w-4" />
    <span className="hidden sm:inline">Anterior</span>
  </a>
);

const PaginationNext = ({ className, ...props }) => (
  <a
    aria-label="Go to next page"
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 hover:bg-slate-100 hover:text-slate-900 gap-1 pr-2.5 ${className}`}
    {...props}
  >
    <span className="hidden sm:inline">Siguiente</span>
    <Icons.ChevronRight className="h-4 w-4" />
  </a>
);

const PaginationEllipsis = ({ className, ...props }) => (
  <span
    aria-hidden
    className={`flex h-9 w-9 items-center justify-center ${className}`}
    {...props}
  >
    <Icons.MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);

const Toast = ({ title, description, actionLabel, onClose }) => (
  <div className="fixed bottom-4 right-4 z-50 animate-slide-in-right">
    <div className="pointer-events-auto flex w-full max-w-md rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
      <div className="p-4 flex-1">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icons.CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-slate-200">
        <button
          onClick={onClose}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  </div>
);

// ============================================================================
// 2. ICONOS (Estilo Lucide)
// ============================================================================
const Icons = {
  Download: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Search: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Filter: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  ArrowRight: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Calendar: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  PanelRightClose: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg>,
  PanelRightOpen: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/></svg>,
  ChevronLeft: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6"/></svg>,
  ChevronRight: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>,
  MoreHorizontal: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  Clock: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  User: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Server: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>,
  CheckCircle: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  ChevronDown: ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>,
};

// ============================================================================
// 3. MOCK DATA Y CONFIGURACIONES
// ============================================================================
const MOCK_TASKS = [
  { id: 1, responsable: "Andrés Rodríguez", tarea: "Migración de base de datos a PostgreSQL", fecha: "2026-05-07", etiqueta: "desarrollos", tiempo: "4h 30m", estado: "en_progreso", plataforma: "Transversal", descripcion: "Se requiere migrar la base de datos principal de MySQL a PostgreSQL para mejorar el rendimiento de las consultas geoespaciales. Esto incluye la adaptación de los modelos ORM y la creación de scripts de migración de datos." },
  { id: 2, responsable: "María Gómez", tarea: "Auditoría de seguridad en Logimat 2", fecha: "2026-05-07", etiqueta: "auditorias", tiempo: "2h 15m", estado: "completada", plataforma: "Logimat 2", descripcion: "Revisión exhaustiva de los logs de acceso y configuración de firewalls para el servidor de Logimat 2 tras el reporte de intentos de acceso no autorizados." },
  { id: 3, responsable: "Carlos Pérez", tarea: "Actualización de API IMC Cargo", fecha: "2026-05-06", etiqueta: "actualizaciones", tiempo: "1h 00m", estado: "bloqueada", plataforma: "IMCCARGO", descripcion: "Actualización de los endpoints REST para soportar el nuevo formato de payload JSON del cliente principal. Bloqueado por falta de documentación del cliente." },
  { id: 4, responsable: "Laura Silva", tarea: "Implementación de métricas OKR Q2", fecha: "2026-05-05", etiqueta: "desarrollos", tiempo: "3h 45m", estado: "completada", plataforma: "Transversal", descripcion: "Creación del dashboard en React para visualizar el progreso de los OKRs del equipo de desarrollo, conectando con la API de Jira." },
  { id: 5, responsable: "Andrés Rodríguez", tarea: "Revisión de tickets diarios soporte", fecha: "2026-05-04", etiqueta: "actualizaciones", tiempo: "1h 30m", estado: "completada", plataforma: "IMC Depósito", descripcion: "Atención a incidencias menores reportadas por los usuarios de bodega relacionadas con la impresión de etiquetas." },
];

const ESTADO_BADGE_MAP = {
  "en_progreso": { variant: "brandOutline", label: "En progreso" },
  "completada": { variant: "success", label: "Completada" },
  "bloqueada": { variant: "destructive", label: "Bloqueada" },
};

const ETIQUETA_BADGE_MAP = {
  "desarrollos": { variant: "default", label: "Desarrollos" },
  "auditorias": { variant: "outline", label: "Auditorías" },
  "actualizaciones": { variant: "secondary", label: "Actualizaciones" },
};

// ============================================================================
// 4. COMPONENTES COMPUESTOS
// ============================================================================

const CalendarMock = ({ onDateSelect }) => {
  const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
  const dates = Array.from({ length: 31 }, (_, i) => i + 1);
  const offset = 4; // Empieza en Jueves
  const [selectedDate, setSelectedDate] = useState(null);

  const handleSelect = (date) => {
    setSelectedDate(date);
    onDateSelect(date);
  };

  return (
    <div className="p-3 bg-white w-full">
      <div className="flex justify-between items-center mb-4 px-1">
        <Button variant="outline" size="icon" className="h-7 w-7"><Icons.ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-sm font-semibold text-slate-900">Mayo 2026</div>
        <Button variant="outline" size="icon" className="h-7 w-7"><Icons.ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {days.map(d => <div key={d} className="text-[0.8rem] font-medium text-slate-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm justify-items-center">
        {Array(offset).fill(null).map((_, i) => <div key={`empty-${i}`} className="w-full" />)}
        {dates.map(date => {
          const isToday = date === 7;
          const isSelected = date === selectedDate;
          return (
            <div 
              key={date} 
              onClick={() => handleSelect(date)}
              className={`flex h-8 w-full max-w-[32px] items-center justify-center rounded-md cursor-pointer transition-colors
                ${isSelected ? 'bg-slate-900 text-white font-bold' : 
                  isToday ? 'bg-red-50 text-red-600 font-bold border border-red-200' : 
                  'hover:bg-slate-100 text-slate-900'}
              `}
            >
              {date}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TaskDetailPanel = ({ task, onClose }) => {
  if (!task) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl border-l border-slate-200 z-50 transform transition-transform animate-slide-in-right overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white/80 backdrop-blur-sm z-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Detalles de Tarea</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
           <Icons.PanelRightClose className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge variant={ETIQUETA_BADGE_MAP[task.etiqueta].variant}>{ETIQUETA_BADGE_MAP[task.etiqueta].label}</Badge>
            <Badge variant={ESTADO_BADGE_MAP[task.estado].variant}>{ESTADO_BADGE_MAP[task.estado].label}</Badge>
          </div>
          <div>
            <h1 className="scroll-m-20 text-2xl font-extrabold tracking-tight lg:text-3xl text-slate-900 mb-2">
              {task.tarea}
            </h1>
            <p className="text-slate-500 leading-7">
              Registrada el {task.fecha}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm font-medium text-slate-500 gap-2">
              <Icons.User className="h-4 w-4" /> Responsable
            </div>
            <div className="font-semibold text-slate-900">{task.responsable}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-sm font-medium text-slate-500 gap-2">
              <Icons.Clock className="h-4 w-4" /> Tiempo invertido
            </div>
            <div className="font-semibold text-slate-900">{task.tiempo}</div>
          </div>
          <div className="space-y-1 col-span-2">
            <div className="flex items-center text-sm font-medium text-slate-500 gap-2">
              <Icons.Server className="h-4 w-4" /> Plataforma
            </div>
            <div className="font-semibold text-slate-900">{task.plataforma}</div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Descripción</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card className="border-none shadow-none bg-slate-50 mt-4">
              <CardContent className="p-4 pt-4">
                <p className="leading-7 text-slate-700 [&:not(:first-child)]:mt-6">
                  {task.descripcion}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="activity">
            <Card className="border-none shadow-none bg-slate-50 mt-4">
              <CardContent className="p-4 pt-4 flex flex-col items-center justify-center text-slate-500 py-8 text-sm">
                No hay historial de actividad adicional.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
           <Button className="w-full">Editar Tarea</Button>
           <Button variant="outline" className="w-full">Marcar Completada</Button>
        </div>
      </div>
    </div>
  );
};

const ScheduleSheet = ({ isOpen, onClose, preselectedDate, onSchedule }) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSchedule();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 transform transition-transform animate-slide-in-right flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Agendar Tarea</h2>
              <p className="text-sm text-slate-500">Programa una tarea para un miembro del equipo.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
               <Icons.PanelRightClose className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <Label>Miembro del equipo</Label>
            <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600">
              <option>Seleccionar miembro...</option>
              <option>Andrés Rodríguez</option>
              <option>María Gómez</option>
              <option>Carlos Pérez</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Fecha programada</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between text-left font-normal"
            >
              {preselectedDate ? `Mayo ${preselectedDate}, 2026` : <span>Seleccionar fecha</span>}
              <Icons.Calendar className="h-4 w-4 text-slate-500" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Hora de inicio</Label>
               <Input type="time" defaultValue="09:00" />
             </div>
             <div className="space-y-2">
               <Label>Duración est.</Label>
               <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600">
                  <option>1 hora</option>
                  <option>2 horas</option>
                  <option>4 horas</option>
               </select>
             </div>
          </div>

          <div className="space-y-2">
            <Label>Título de la tarea</Label>
            <Input placeholder="Ej. Revisión de pull requests" required />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea placeholder="Detalles de lo que se debe realizar..." />
          </div>
        </form>

        <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
          <Button type="submit" onClick={handleSubmit} className="flex-1">Agendar</Button>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        </div>
      </div>
    </>
  );
};


// ============================================================================
// 5. VISTA PRINCIPAL
// ============================================================================
export default function TaskDashboardRed() {
  // Estados Generales
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showToast, setShowToast] = useState(false);

  // Estados para Resize nativo
  const [sidebarWidth, setSidebarWidth] = useState(320); // Ancho por defecto
  const [isDragging, setIsDragging] = useState(false);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setIsScheduleOpen(true);
  };

  const handleScheduleComplete = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // --- Lógica de Resizable ---
  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback((e) => {
    if (isDragging) {
      // Calcular nuevo ancho basado en el ancho de la ventana menos la posición X del ratón
      const newWidth = document.body.clientWidth - e.clientX;
      
      // Limites de resizable (Min: 280px, Max: 600px)
      if (newWidth >= 280 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      // Evitar selección de texto y cambiar cursor global
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isDragging, resize, stopResizing]);

  return (
    <div className="min-h-screen bg-slate-50 font-roboto text-slate-900 overflow-hidden flex flex-col">
      <GlobalStyles />
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-1.5 bg-red-600 rounded-full"></div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Gestión de Tareas</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          
          <Button variant="outline" className="hidden sm:flex gap-2">
            <Icons.Download className="h-4 w-4" /> Exportar
          </Button>
          
          <Button onClick={() => setIsScheduleOpen(true)}>Nueva Tarea</Button>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`ml-2 transition-colors ${isSidebarOpen ? 'bg-slate-100' : ''}`}
            aria-label="Alternar Panel Lateral"
          >
            {isSidebarOpen ? <Icons.PanelRightClose className="h-4 w-4" /> : <Icons.PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Contenido Principal */}
        <main className={`flex-1 overflow-y-auto p-6 min-w-[300px] transition-all ${isDragging ? 'duration-0' : 'duration-300'} ${isSidebarOpen ? 'pr-6 md:pr-4' : 'pr-6'}`}>
          <div className="mx-auto max-w-5xl space-y-6">
            
            {/* Filters Section */}
            <Card className="animate-fade-in-up">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                <div className="space-y-1.5 flex-1 w-full">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Buscar</label>
                  <div className="relative group">
                    <Icons.Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-red-600 transition-colors" />
                    <Input placeholder="Ej. Migración..." className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5 flex-1 w-full md:max-w-[200px]">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Responsable</label>
                  <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600">
                    <option>Todos</option>
                    <option>Andrés Rodríguez</option>
                  </select>
                </div>
                <div className="space-y-1.5 flex-1 w-full md:max-w-[212px]">
                   <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</label>
                   <Button variant="outline" className="w-full justify-between font-normal text-slate-500 bg-white">
                      <span>Elegir fecha</span>
                      <Icons.ChevronDown className="h-4 w-4 opacity-50" />
                   </Button>
                </div>
                <Button variant="outline" size="icon" aria-label="Filtrar">
                  <Icons.Filter className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="animate-fade-in-up delay-100 flex flex-col">
              <div className="relative w-full overflow-auto flex-1 min-h-[300px]">
                <table className="w-full caption-bottom text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Responsable", "Tarea", "Etiqueta", "Tiempo", "Estado", "Acción"].map((head) => (
                        <th key={head} className="h-12 px-4 align-middle font-semibold text-slate-600 text-xs uppercase tracking-wider">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_TASKS.map((task) => {
                      const estado = ESTADO_BADGE_MAP[task.estado];
                      const etiqueta = ETIQUETA_BADGE_MAP[task.etiqueta];
                      
                      return (
                        <tr key={task.id} className="transition-colors hover:bg-slate-50/80 group">
                          <td className="px-4 py-3 font-medium text-slate-900">{task.responsable}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-[250px] truncate">{task.tarea}</td>
                          <td className="px-4 py-3">
                            <Badge variant={etiqueta.variant} className={etiqueta.className}>{etiqueta.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{task.tiempo}</td>
                          <td className="px-4 py-3">
                            <Badge variant={estado.variant} className={estado.className}>{estado.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setSelectedTask(task)}
                              >
                                Ver Detalle <Icons.ArrowRight className="h-3 w-3" />
                             </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 border-t border-slate-200 bg-white rounded-b-xl">
                 <Pagination>
                   <PaginationContent>
                     <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                     <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
                     <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
                     <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
                     <PaginationItem><PaginationEllipsis /></PaginationItem>
                     <PaginationItem><PaginationNext href="#" /></PaginationItem>
                   </PaginationContent>
                 </Pagination>
              </div>
            </Card>
            
          </div>
        </main>

        {/* Panel Lateral Derecho (Calendario / Agenda) con Lógica Resizable NATIVA */}
        <aside 
          className={`
            border-l border-slate-200 bg-slate-50 ease-in-out z-20 flex flex-col relative
            ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full overflow-hidden border-l-0'}
            ${isDragging ? 'transition-none' : 'transition-all duration-300'}
          `}
          style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
        >
          {/* Handler (Borde Arrastrable) */}
          {isSidebarOpen && (
             <div 
               className={`absolute left-0 top-0 bottom-0 w-2 hover:w-3 cursor-col-resize z-30 transition-colors transform -translate-x-1/2 ${isDragging ? 'bg-red-500' : 'bg-transparent hover:bg-red-200'}`}
               onMouseDown={startResizing}
               title="Arrastrar para ajustar tamaño"
             />
          )}

          {/* Contenido del Panel (Fijo al ancho configurado, flex-shrink-0) */}
          <div className="w-full flex flex-col h-full bg-white relative">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 text-slate-900 font-semibold bg-white flex-shrink-0">
              <Icons.Calendar className="h-5 w-5 text-red-600" />
              Agenda de Tareas
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 border-b border-slate-100">
                <CalendarMock onDateSelect={handleDateSelect} />
              </div>

              <div className="p-4 space-y-4 bg-slate-50 min-h-full">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Para Hoy (Mayo 7)</h4>
                  <Badge variant="secondary" className="font-normal text-[10px]">2 Tareas</Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-red-200 transition-colors cursor-pointer" onClick={() => setSelectedTask(MOCK_TASKS[0])}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-semibold text-slate-900 leading-tight">Migración PostgreSQL</span>
                      <span className="text-xs font-medium text-slate-500">09:00</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">AR</div>
                      <p className="text-xs text-slate-600 truncate">Andrés Rodríguez</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-red-200 transition-colors cursor-pointer" onClick={() => setSelectedTask(MOCK_TASKS[1])}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-semibold text-slate-900 leading-tight">Auditoría Logimat 2</span>
                      <span className="text-xs font-medium text-slate-500">14:30</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">MG</div>
                      <p className="text-xs text-slate-600 truncate">María Gómez</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlays Absolutos */}
        <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
        <ScheduleSheet isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} preselectedDate={selectedDate} onSchedule={handleScheduleComplete} />
        
        {/* Toast Notification */}
        {showToast && (
          <Toast 
            title="Tarea Agendada" 
            description={selectedDate ? `Para Mayo ${selectedDate}, 2026` : "La tarea ha sido programada exitosamente."}
            actionLabel="Deshacer"
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </div>
  );
}

Analiza y mira el plan para que quede bien implementado en la intranet, aun no implementes nada