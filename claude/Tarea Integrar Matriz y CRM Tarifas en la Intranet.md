# Tarea: Integrar Matriz y CRM Tarifas en la Intranet

## Contexto
La intranet ZYMO ya está desplegada en zymointranet.com con auth JWT y roles. 
Ahora necesitamos conectar las apps existentes para que funcionen desde la intranet.

## Apps a integrar

### Matriz
- **URL producción:** matriz.zymointranet.com
- **Repo:** https://github.com/Andresrs1014/Matriz
- **Puerto servidor:** 80 (frontend), 8000 (backend)
- **Estado:** Desplegada y funcionando en el servidor

### CRM Tarifas
- **Repo:** https://github.com/Andresrs1014/crm_tarifas
- **Branch activo:** frfrbranch
- **Puerto servidor:** Por asignar (sugerido: 82 frontend, 8002 backend)
- **Estado:** Actualizado localmente, pendiente de deploy en servidor

## Tareas

### 1. Crear usuario admin automáticamente
En el `lifespan` de FastAPI de la intranet, verificar si existe algún usuario admin.
Si no existe, crear uno por defecto:
- email: admin@zymo.com
- password: Admin123*
- role: admin
- full_name: Administrador ZYMO

Esto debe correr solo en el primer arranque. Si el admin ya existe, no hacer nada.

### 2. AppCards en el Dashboard
El dashboard de la intranet debe mostrar las apps según el rol del usuario.
Cada AppCard debe tener:
- Nombre de la app
- Descripción corta
- Ícono representativo
- Botón que abre la app en nueva pestaña

Configuración de apps por rol:

| App                   | URL                                     | Roles con acceso       |
| --------------------- | --------------------------------------- | ---------------------- |
| Matriz                | https://matriz.zymointranet.com         | Todos los roles        |
| CRM Tarifas           | https://crm.zymointranet.com            | admin, comercial       |
| OC Automatizaciones   | https://oc.zymointranet.com             | admin, talento_cultura |
| Portal Capacitaciones | https://capacitaciones.zymointranet.com | admin, talento_cultura |

### 3. Deploy CRM Tarifas en servidor
El CRM necesita su propio docker-compose.yml para desplegarse en el servidor.
- Frontend: puerto 82
- Backend: puerto 8002
- Branch: frfrbranch
- Variables de entorno: revisar .env.example del repo

Crear también:
- Dockerfile backend (si no existe)
- Dockerfile frontend multistage Nginx (si no existe)
- docker-compose.yml en la raíz del proyecto
- Script deploy-crm.sh para el webhook CI/CD

### 4. Configuración Cloudflare (manual - no automatizable)
Una vez deployado el CRM, agregar en Cloudflare Tunnel:
- crm.zymointranet.com → localhost:82

### 5. Subdominio intranet
Verificar que el subdominio en Cloudflare esté correcto:
- zymointranet.com → localhost:81 ✅ (ya configurado)
- matriz.zymointranet.com → localhost:80 ✅ (ya configurado)
- crm.zymointranet.com → localhost:82 ⏳ (pendiente)

## Notas importantes
- No cambiar puertos de Matriz (80 y 8000) — ya están en producción
- El CRM usa SQLite igual que Matriz e Intranet
- Mantener el mismo patrón de Docker multistage que Matriz
- El webhook secret es: zymo2024secret
- El servidor es Ubuntu 24.04 con Docker instalado
- CI/CD via webhook en webhook.zymointranet.com

## Resultado esperado
1. La intranet crea admin automáticamente en primer arranque
2. Cada usuario ve solo las apps de su rol en el dashboard
3. El CRM está desplegado y accesible en crm.zymointranet.com
4. Las tres apps (Intranet, Matriz, CRM) corren simultáneamente en el servidor