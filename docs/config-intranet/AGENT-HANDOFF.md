# Handoff para agentes — Configuración Intranet

**Leer primero:** [README.md](./README.md) → luego este archivo.

---

## Contexto en una frase

Estamos construyendo la **gobernanza central** de la intranet: admin configura roles/herramientas; el **directorio T&C** alimenta los selects de cada módulo con filtros por equipo.

---

## Qué ya está hecho (2026-07-16)

✅ Catálogo permisos completo en RolesPage  
✅ JWT con `app_permissions` en login  
✅ Nav admin entre Usuarios / Roles / Áreas  
✅ **Fase 3a Tareas v2:** `directory_cache` + sync + API + UI agregar desde directorio  
✅ Documentación en `docs/config-intranet/`

**Estado git:** cambios locales sin commit (revisar con `git status`).

---

## Qué hacer a continuación (prioridad sugerida)

### 1. Fase 3b — Filtro por herramienta/equipo

~~Fase 3a Tareas v2~~ ✅ Hecho — ver CHANGELOG 2026-07-16.

Extender sobre infra existente (no tabla nueva salvo necesidad real):
- `ZymoConfigList.isActive` + metadata de filtro
- `user_tools` / `TeamMember` para pools de personas
- Config admin (solo admin) — posible tab en AdminPage o extensión RolesPage

### 3. Opcional — ampliar user_tools

Si el negocio quiere "habilitar herramienta por usuario" para más módulos:
- Agregar keys a `TOOLS` en `AdminPage.tsx`
- Gating en `permissions.ts` + sidebar

### 4. Deuda documental

- Actualizar `CLAUDE.md`: `mod_tc`, `personal.db`, link a `docs/config-intranet/`
- Considerar seed `mod_tc_sensible` en `talento_cultura`

---

## Reglas de implementación (repo)

- **Ponytail:** diff mínimo; reutilizar patrones existentes.
- **No commit** salvo petición explícita del usuario.
- **Frontend TS:** verificar con `npm run build` (no `tsc --noEmit` raíz).
- **Backends Node:** `npx tsc --noEmit` antes de commit.
- Permiso T&C: **`mod_tc`**, nunca `mod_tyc`.

---

## Pruebas manuales rápidas

1. Admin → Roles → ver grupos T&C, Tickets, SAC.
2. Asignar `mod_tickets` a rol de prueba → usuario re-login → API tickets 200.
3. Admin → nav Usuarios / Roles / Áreas funciona en las 3 pantallas.

---

## Contacto entre agentes

Al terminar una sesión:
1. Añadir entrada en [CHANGELOG.md](./CHANGELOG.md).
2. Actualizar tabla "Estado resumido" en [README.md](./README.md) si cambió una fase.
3. Mencionar archivos tocados y qué quedó pendiente.

---

## Preguntas abiertas (decisión humana)

1. ¿Primer módulo para sync post-Tickets: **Tareas** o **SAC**?
2. ¿`mod_tc_sensible` va en seed default de `talento_cultura`?
3. ¿Unificar configs dispersas (OC SMTP, T&C WA) en hub admin futuro?
