# Despliegue: permisos por persona + pantalla Organización

Alcance acotado. Nada de esto cambia lo que cada persona ve hoy: los permisos por persona se SUMAN a los del rol y a las reglas
históricas por área.

## Qué incluye

**Backend (Python)**
- Tablas nuevas `usuario_permiso` y `herramienta_acceso` (se crean solas al arrancar; no tocan tablas existentes).
- Al iniciar sesión y en `/auth/me`, los permisos son los del rol + los asignados a la persona (`routers/auth.py`, `core/permissions.py`).
- Rutas nuevas, solo administrador: `/areas/{id}/usuarios` (listar, crear), `/areas/{id}/usuarios/{uid}/cargo`, `/areas/{id}/usuarios/{uid}/permisos`, `/areas/{id}/cargos`, `/acceso/exclusivos`.
- `scripts/marcar_accesos_actuales.py`: deja marcado como permiso de la persona lo que hoy ya ve por su rol o por su área histórica.

**Frontend**
- Pantalla `/admin/configuracion/organizacion` (áreas, personas, cargo y «Editar permisos» por persona, herramientas). Se suma a Configuración; Usuarios, Roles y Áreas siguen donde estaban.
- `nginx.conf`: el prefijo `/acceso` va al backend.

## Qué NO incluye (a propósito)
- Renombres de permisos (`mod_operativo`, `mod_oper_clientes`, `mod_operativo_tickets` siguen con su nombre), eliminación de Gerencial/ZYMO, rutas nuevas (`/solicitudes`…), página de inicio, vistas previas.
- Cambios al SIG (carpetas desde áreas, vista de líder, cola de revisión de archivos) y KPI.

## Antes de subir
1. Respaldo del día (`ops/backup/daily-copy.sh`) y anotar el commit que corre hoy (`git rev-parse HEAD` en el servidor).
2. Inventario de accesos de hoy: `C:\Gestion_documental\Documentacion\accesos-produccion-2026-10-15.csv` (42 usuarios).
3. Nunca `docker compose down -v`.

## Subir
```
git pull
docker compose up -d --build backend frontend     # solo esos dos servicios
docker compose logs --tail=50 backend             # debe decir que arrancó sin errores
```
Las sesiones abiertas conservan su token hasta que cierren sesión; lo asignado por persona aplica en el siguiente inicio de sesión.

## Dejar creadas todas las áreas
```
docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python -" < backend/scripts/areas_faltantes.py            # simulación
docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python - --aplicar" < backend/scripts/areas_faltantes.py
```
Solo agrega (compara sin mayúsculas ni tildes): hoy en producción crearía 4 áreas: «Operaciones IMCC», «Operaciones IMCD», «SIG» y «Servicio al Cliente» (las carpetas del SIG que la intranet no tiene con ese nombre; no se unifican con Operaciones IMCCARGO, Operaciones IMC DEPOSITO ni Sistemas de Gestión). El área de un usuario también
se reconoce sin importar mayúsculas (3 usuarios tienen «Planeación y consultoria»).

## Dejar marcados a quienes ya ven Financiero, Compras y Tareas
```
# 1) simulación (no escribe nada)
docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python -" < backend/scripts/marcar_accesos_actuales.py
# 2) aplicar
docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python - --aplicar" < backend/scripts/marcar_accesos_actuales.py
# deshacer lo que agregó (el archivo lo imprime --aplicar)
docker exec -i <backend> sh -c "cd /app && PYTHONPATH=/app python - --revertir /tmp/marcados-AAAAMMDD-HHMMSS.json" < backend/scripts/marcar_accesos_actuales.py
```
Gestión de Tareas ya es por persona (`user_tools`) y por equipo: no necesita marca.

## Dar a una persona acceso al SIG para subir procedimientos
Organización → su área → «Editar permisos» → marcar el permiso del SIG (`mod_sig`). Entra en su siguiente inicio de sesión.
`mod_sig` permite cargar procedimientos y versiones nuevas; una versión de alguien que no es gerente queda **pendiente de revisión**
y solo un gerente o administrador la aprueba o rechaza. Ojo: en el SIG actual `mod_sig` también permite editar y borrar formatos,
instructivos y anexos; no permite borrar procedimientos ni aprobar.

## Volver atrás
- Marcas: `--revertir` (arriba) o borrar filas de `usuario_permiso`.
- Código: `git checkout <commit anotado> && docker compose up -d --build backend frontend`. Las tablas nuevas pueden quedarse: nada las lee sin este código.
