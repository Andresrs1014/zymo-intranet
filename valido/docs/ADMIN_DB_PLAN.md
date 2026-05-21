# Plan de Administración de Bases de Datos (Zymo Intranet)

**Objetivo:** Crear un panel de administración exclusivo para el Super Admin para gestionar respaldos, purgas de datos transaccionales, consultas globales y generación de reportes estructurados para múltiples bases de datos.

## Principios Core (Mandatos de la Arquitectura)
1. **Seguridad "Sudo Mode":** Se requerirá una validación adicional mediante una clave maestra (cuyo Hash estará en el `.env`) para acceder y operar estas rutas.
2. **ACID y Cero Deuda Técnica:** Las operaciones destructivas se harán bajo transacciones seguras. Nada se rompe en el flujo normal de usuarios.
3. **Entorno Docker Aislado:** El código debe estar preparado para correr en el servidor de Ubuntu bajo Docker, sin depender de binarios locales en el entorno de desarrollo.
4. **UX/UI Optimizada:** Interfaces limpias, modales de confirmación con `backdrop-blur`, y zonas de peligro claramente delimitadas (basado en lineamientos `ui-ux-pro-max`).

---

## Fase 1: Capa de Seguridad Sudo Mode (Backend)
- **Hash Maestro:** Variable `ADMIN_SUDO_HASH` en `.env`.
- **Autenticación Sudo:** Endpoint `/api/admin/sudo-auth` que emite un Sudo JWT (corta duración: 10-15 min).
- **Middleware/Dependency:** Todas las rutas de `/api/admin/dbs` estarán protegidas exigiendo el Sudo JWT, previniendo escalada de privilegios si una sesión normal de admin es secuestrada.

## Fase 2: Gestor y Buscador de Múltiples DBs (Backend)
- **Conexiones Dinámicas:** Administrador de conexiones capaz de interactuar con las 5 bases de datos sin código espagueti.
- **Buscador Global:** Endpoint unificado que permite buscar una cadena de texto (ej. un nombre o ID) iterando de forma asíncrona sobre tablas indexadas clave de las distintas BDs.
- **Filtros Flexibles:** Filtros SQL por Fecha (Semana, Mes, Año), Área y Usuario.

## Fase 3: Reportes y Purga de Datos "Reinicio"
- **Reportes por Rango de Tiempo:** Filtros estrictos de descarga (Por Semana, Por Mes, Por Año). Para el reporte anual, se utilizarán "chunks" asíncronos y tareas en segundo plano para evitar Timeouts HTTP (`apscheduler` + BackgroundTasks).
- **Purga Selectiva ("Reinicio"):**
  - **Mecanismo:** Un flujo donde primero se fuerza o se valida un Backup de las tablas.
  - **Limpieza Transaccional:** Vaciado (`TRUNCATE` / `DELETE`) estricto de tablas de operaciones (ej. solicitudes de compra, logs).
  - **Inmunidad Core:** Tablas maestras (usuarios, perfiles, sesiones, áreas) **nunca** son afectadas por esta purga.

## Fase 4: Interfaz UI/UX (Frontend)
- **Sudo Modal:** Barrera inicial exigiendo la clave.
- **Dashboard Multibase:** Sidebar con las 5 bases de datos.
- **Spotlight Search:** Barra de búsqueda global.
- **Panel de Reportes:** Tarjetas limpias con selectores de Rango de Fechas (Semana/Mes/Año), Área y Usuario. Tabla de previsualización paginada.
- **Danger Zone (Zona Roja):** Botones para la Purga de Datos. Requieren escribir la palabra "CONFIRMAR" o la Sudo Key nuevamente para evitar clics accidentales.

---
*Nota: Este plan se archiva para futura implementación, garantizando que los flujos actuales del sistema no se verán comprometidos.*