# Plan de Seguridad — zymo-intranet
**Fecha:** 2026-04-24
**Tipo:** Defense in Depth (3 capas)
**Servidor:** Ubuntu + Docker Compose
**Contexto:** Intranet semi-expuesta (IP pública, solo empleados), módulos sensibles: Gerencial, Financiero, SGC, Administrativo

---

## Resumen Ejecutivo

La intranet actualmente funciona correctamente pero tiene gaps de seguridad que la exponen a ataques de fuerza bruta en el login, configuración CORS permisiva, y ausencia de protección a nivel de red. Este plan los cierra en 3 capas sin impacto perceptible en rendimiento.

---

## Arquitectura de Seguridad (3 Capas)

```
Internet
   │
   ▼
[UFW Firewall]         ← Capa 1: Solo puertos 22, 80, 443
   │
   ▼
[nginx reverse proxy]  ← Capa 2: Rate limiting, SSL, headers de seguridad
   │
   ▼
[Docker: FastAPI]      ← Capa 3: App hardening, lockout, CORS estricto
   │
   ▼
[Docker: Base de datos]  ← Sin puerto expuesto al exterior
```

---

## CAPA 1 — Servidor Ubuntu

### 1.1 UFW Firewall

**Objetivo:** Cerrar todos los puertos excepto los estrictamente necesarios.

**Reglas a configurar:**
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP (nginx lo redirige a HTTPS)
ufw allow 443/tcp       # HTTPS
ufw enable
```

**Verificar que el puerto 8000 (FastAPI directo) NO sea accesible:**
```bash
ufw deny 8000/tcp
```

> FastAPI solo debe ser accesible desde nginx internamente dentro de Docker, nunca desde internet directo.

**Cómo verificar que está correcto:**
```bash
ufw status verbose
# Debe mostrar solo 22, 80, 443 como ALLOW
```

---

### 1.2 fail2ban

**Objetivo:** Banear IPs que intenten ataques de fuerza bruta en SSH y HTTP.

**Jails a configurar:**

| Jail | Trigger | Ban |
|------|---------|-----|
| sshd | 5 intentos fallidos de SSH | 1 hora |
| nginx-http-auth | 10 intentos en 5 min | 30 min |
| nginx-login | 10 requests a /auth/token en 1 min | 15 min |

**Archivos a crear:**
- `/etc/fail2ban/jail.local` — configuración base
- `/etc/fail2ban/filter.d/nginx-login.conf` — filtro custom para el endpoint de login

**Cómo verificar:**
```bash
fail2ban-client status
fail2ban-client status nginx-login
```

---

### 1.3 Docker Hardening

**Objetivo:** Que los contenedores no corran como root y no expongan puertos innecesarios.

**Cambios en Dockerfile del backend:**
```dockerfile
# Al final del Dockerfile, agregar:
RUN adduser --disabled-password --gecos '' appuser
USER appuser
```

**Cambios en docker-compose.yml:**
- FastAPI: NO mapear puerto 8000 al host (o mapearlo solo a 127.0.0.1:8000)
- nginx: mapear 80 y 443 al host
- Base de datos: NO exponer puerto al host

**Ejemplo correcto en compose:**
```yaml
services:
  backend:
    # Sin "ports:" aquí — solo nginx llega al backend
    networks:
      - internal

  nginx:
    ports:
      - "80:80"
      - "443:443"
    networks:
      - internal
      - external

networks:
  internal:
    internal: true   # Sin acceso a internet directo
  external:
```

---

## CAPA 2 — nginx Reverse Proxy

### 2.1 SSL/TLS con Let's Encrypt

**Objetivo:** Todo el tráfico encriptado, HTTP redirige a HTTPS.

**Instalación:**
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com
```

**Renovación automática** (certbot ya lo configura, verificar):
```bash
certbot renew --dry-run
```

**Configuración TLS en nginx:**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

---

### 2.2 Rate Limiting

**Objetivo:** Limitar requests por IP para prevenir fuerza bruta y abuso.

**Configuración nginx:**
```nginx
# En nginx.conf (bloque http):
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

# En el server block:
location /auth/token {
    limit_req zone=login burst=5 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
}

location /api/ {
    limit_req zone=api burst=20 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
}
```

---

### 2.3 Headers de Seguridad

**Objetivo:** Proteger contra clickjacking, XSS, MIME sniffing, y ataques de protocolo.

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-XSS-Protection "1; mode=block" always;
server_tokens off;   # Oculta versión de nginx
```

---

### 2.4 Protección contra Slowloris

**Objetivo:** Prevenir ataques que mantienen conexiones abiertas indefinidamente.

```nginx
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 15s;
send_timeout 10s;
```

---

### 2.5 GZIP (rendimiento + seguridad)

```nginx
gzip on;
gzip_types application/json text/plain text/css application/javascript;
gzip_min_length 1000;
```

---

## CAPA 3 — Aplicación FastAPI

### 3.1 Rate Limiting en App (slowapi)

**Objetivo:** Segunda línea de defensa en login, independiente de nginx.

**Dependencia a agregar:**
```
slowapi==0.1.9
```

**Implementación en `/auth/token`:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/token")
@limiter.limit("10/minute")
def login(request: Request, ...):
    ...
```

> Si nginx ya tiene rate limiting, esto es una segunda red de seguridad. Si nginx no está en alguna configuración de dev, esta capa protege igual.

---

### 3.2 CORS Estricto

**Cambio en `main.py`:**

```python
# ANTES (inseguro):
allow_methods=["*"],
allow_headers=["*"],

# DESPUÉS (correcto):
allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
allow_headers=["Authorization", "Content-Type"],
```

Los `allow_origins` ya se configuran desde `.env` — verificar que en producción esté el dominio exacto, no `*`.

---

### 3.3 Política de Contraseñas

**Cambio en `RegisterRequest` en `auth.py`:**

```python
@field_validator("password")
@classmethod
def password_strength(cls, v: str) -> str:
    import re
    if len(v) < 8:
        raise ValueError("Mínimo 8 caracteres.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Debe contener al menos una mayúscula.")
    if not re.search(r"\d", v):
        raise ValueError("Debe contener al menos un número.")
    if not re.search(r"[^a-zA-Z0-9]", v):
        raise ValueError("Debe contener al menos un carácter especial.")
    return v
```

---

### 3.4 Account Lockout Temporal

**Objetivo:** Bloquear temporalmente una cuenta después de 5 intentos fallidos.

**Implementación en `auth.py` (en memoria, sin Redis):**

```python
from collections import defaultdict
from datetime import datetime, timedelta

_failed_attempts: dict[str, list[datetime]] = defaultdict(list)
LOCKOUT_THRESHOLD = 5
LOCKOUT_WINDOW = timedelta(minutes=5)
LOCKOUT_DURATION = timedelta(minutes=15)

def _check_lockout(email: str) -> None:
    now = datetime.utcnow()
    attempts = _failed_attempts[email]
    # Limpiar intentos fuera de la ventana
    _failed_attempts[email] = [t for t in attempts if now - t < LOCKOUT_WINDOW]
    if len(_failed_attempts[email]) >= LOCKOUT_THRESHOLD:
        raise HTTPException(401, "Credenciales incorrectas.")  # Respuesta genérica

def _register_failed(email: str) -> None:
    _failed_attempts[email].append(datetime.utcnow())
```

> La respuesta siempre es genérica ("Credenciales incorrectas") — nunca revelar si es lockout, cuenta inexistente, o contraseña incorrecta.

> **Limitación conocida:** Este estado se pierde al reiniciar el contenedor. Para producción esto es aceptable — fail2ban en nginx es la primera línea contra fuerza bruta. Si se quiere persistencia, se puede mover a Redis en el futuro.

---

### 3.5 JWT — Reducción de Expiración

**Cambio en `config.py`:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 240  # 4h en lugar de 8h
```

El frontend ya recarga el usuario al iniciar (`/auth/me`), por lo que 4h no rompe UX.

---

### 3.6 Eliminar Contraseña Default Admin

**Cambio en `config.py`:**
```python
# ANTES:
FIRST_ADMIN_PASSWORD: str = "Admin123*"

# DESPUÉS:
FIRST_ADMIN_PASSWORD: str  # Sin default — obligatorio en .env
```

**Fail fast si falta:**
```python
# En main.py, al arrancar:
if not settings.FIRST_ADMIN_PASSWORD:
    raise RuntimeError("FIRST_ADMIN_PASSWORD es obligatorio en .env")
```

---

### 3.7 Logging de Acceso a Módulos Sensibles

**Objetivo:** Auditoría de quién accede a Gerencial, Financiero, SGC, Administrativo.

**Implementación en `deps.py`:**
```python
import logging
logger = logging.getLogger("security.access")

def require_financiero(request: Request, current_user: User = Depends(get_current_user)):
    if current_user.role not in FINANCIERO_ROLES:
        logger.warning(f"ACCESO_DENEGADO user={current_user.email} role={current_user.role} path={request.url.path} ip={request.client.host}")
        raise HTTPException(403, "Acceso denegado.")
    logger.info(f"ACCESO user={current_user.email} role={current_user.role} path={request.url.path}")
    return current_user
```

**Logs a archivo rotativo** (en `main.py`):
```python
import logging.handlers
handler = logging.handlers.RotatingFileHandler(
    "logs/security.log", maxBytes=5_000_000, backupCount=5
)
```

---

## Orden de Implementación (sin fallos)

Seguir exactamente este orden para evitar dejar la intranet inaccesible:

```
Fase 1 — Servidor (sin tocar la app)
  1. Instalar fail2ban y configurar jails SSH
  2. Configurar UFW (verificar que SSH no quede bloqueado ANTES de activar)
  3. Verificar acceso SSH después de UFW — si funciona, continuar

Fase 2 — nginx + SSL
  4. Instalar nginx si no está instalado
  5. Configurar nginx como reverse proxy (sin SSL primero, verificar que la app responde)
  6. Agregar SSL con certbot
  7. Agregar rate limiting y headers de seguridad
  8. Cerrar puerto 8000 en UFW

Fase 3 — Docker
  9. Actualizar docker-compose.yml (redes internas, sin puerto 8000 expuesto)
  10. Agregar usuario non-root en Dockerfile
  11. Rebuild y verificar que nginx llega al backend

Fase 4 — App FastAPI
  12. Agregar slowapi (rate limiting)
  13. Corregir CORS
  14. Mejorar política de contraseñas
  15. Agregar account lockout
  16. Reducir JWT a 4h
  17. Eliminar contraseña default admin del config
  18. Agregar logging de acceso sensible

Fase 5 — Verificación final
  19. Test de login normal — debe funcionar
  20. Test de 11 logins fallidos — debe devolver 429 o bloquear
  21. Test de acceso sin token — debe devolver 401
  22. Test de acceso con rol incorrecto — debe devolver 403
  23. Verificar headers en respuesta (HSTS, X-Frame-Options, etc.)
  24. Confirmar logs en logs/security.log
```

---

## Checklist de Verificación Final

- [ ] UFW activo con solo puertos 22, 80, 443
- [ ] Puerto 8000 no accesible desde internet
- [ ] fail2ban corriendo y monitoreando SSH + nginx
- [ ] HTTPS funcionando con certificado válido
- [ ] HTTP redirige a HTTPS
- [ ] Rate limiting activo en /auth/token
- [ ] Headers de seguridad presentes en respuestas
- [ ] CORS restringido a dominio exacto
- [ ] 11 intentos de login fallidos resultan en bloqueo
- [ ] Contraseña default admin eliminada del código
- [ ] Logs de acceso a módulos sensibles funcionando
- [ ] Docker corriendo sin root, puerto 8000 solo interno

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Quedar sin acceso SSH al activar UFW | Configurar regla SSH ANTES de `ufw enable`, verificar conexión |
| nginx mal configurado deja la app caída | Probar con `nginx -t` antes de recargar, mantener config anterior |
| fail2ban banea tu propia IP | Agregar IP de administrador a whitelist en `jail.local` |
| Let's Encrypt falla (dominio mal configurado) | DNS debe apuntar al servidor ANTES de correr certbot |
| Account lockout bloquea usuario legítimo | Lockout es 15min, se resetea solo. Admin puede reiniciar contenedor si es urgente |
| Contraseña admin forzada rompe entorno dev | En `.env.dev` poner una contraseña de desarrollo, en `.env.prod` la real |

---

## Archivos que se Modificarán en Implementación

| Archivo | Cambio |
|---------|--------|
| `backend/Dockerfile` | Usuario non-root |
| `docker-compose.yml` | Redes internas, sin puerto 8000 al host |
| `nginx/nginx.conf` | Rate limiting, headers, SSL, reverse proxy |
| `backend/app/config.py` | JWT 4h, eliminar password default |
| `backend/app/main.py` | CORS estricto, fail fast config, logging setup |
| `backend/app/routers/auth.py` | slowapi, account lockout, password policy |
| `backend/app/core/deps.py` | Logging de acceso a módulos sensibles |
| `/etc/ufw/` | Reglas de firewall (en servidor) |
| `/etc/fail2ban/` | Jails (en servidor) |

---

*Este documento describe el diseño. La implementación se realizará por fases según el orden indicado arriba.*
