## Decisiones de Arquitectura

### Autenticación
- JWT con refresh tokens
- Mismo patrón implementado en Matriz y CRM Tarifas
- Token incluye rol del usuario para control de acceso en frontend y backend

### Control de Acceso
- Frontend: rutas y componentes protegidos por rol
- Backend: decoradores de dependencia FastAPI por rol
- Las apps externas reciben el token JWT en query param o header para futura integración

### Base de Datos
- SQLite en desarrollo y producción inicial
- Volumen Docker persistente fuera del contenedor
- Migrable a PostgreSQL cuando el servidor nuevo llegue

### Docker
- Multistage build en frontend (Node builder + Nginx)
- Backend expuesto en puerto 8001 (8000 ocupado por Matriz)
- Frontend en puerto 81 (80 ocupado por Matriz)
- Nginx reverse proxy enruta por subdominio

## Módulos Futuros (No para el 7 de abril)
- Inventario de activos (campos: Grupo, Descripción, Placa, Serial, Fecha Compra, Ubicación, Persona Responsable, Empresa, Categoría, Estado)
- Talento y Cultura — directorio de empleados
- SIG — gestión de documentos
- Gestión IT
- KPIs e indicadores para directivos
- Landing page con parallax cinematográfico

## Para el 7 de Abril — MVP
1. ✅ Login funcional con JWT
2. ✅ Dashboard por rol — cada usuario ve solo sus apps
3. ✅ AppCards con acceso directo a las apps del grupo
4. ✅ Diseño corporativo azul, blanco y amarillo
5. ✅ Deploy en zymointranet.com
6. ✅ CI/CD desde GitHub

## Instrucciones para Claude Code

### Antes de empezar
1. Leer este archivo completo
2. Revisar el código de Matriz para entender el patrón de auth JWT ya implementado
3. No inventar patrones nuevos — replicar lo que ya funciona en Matriz

### Durante el desarrollo
- Backend primero, siempre
- Cada endpoint debe tener su dependencia de rol
- No hardcodear URLs — usar variables de entorno
- El puerto del backend es 8001, el del frontend es 81

### Patrones obligatorios
- Pydantic v2 para validación
- SQLModel para modelos
- Zustand para estado global en frontend
- TanStack Query para llamadas a la API
- Tailwind para estilos

### Lo que NO debe hacer
- No cambiar la arquitectura sin consultar
- No usar PostgreSQL aún
- No integrar tokens con las apps externas todavía
- No desarrollar módulos futuros antes de tener el MVP listo