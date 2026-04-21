# Semana 2 — Módulo Gerencial, Memoria Persistente, PWA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activar el módulo gerencial completo (backend + frontend 3 vistas), inyectar memoria persistente en los agentes, preparar el piloto RAG con Sonia, hacer la intranet instalable como PWA y agregar drag táctil al agente flotante.

**Architecture:** Backend FastAPI con SQLite (fallback de PostgreSQL configurado en `gerencial_database.py`). Frontend React 19 + Tailwind + Recharts para gráficas. La memoria de agentes se inyecta como contexto enriquecido al mensaje antes de enviarlo a Gemini — sin tocar `base.py`. Cada tab del módulo gerencial es un componente independiente para mantener archivos enfocados.

**Tech Stack:** FastAPI, SQLModel, SQLite/PostgreSQL, google-generativeai, React 19, TypeScript, Tailwind CSS, Recharts, Zustand, TanStack Query, React Router v7

---

## Mapa de archivos

### Crear
| Archivo | Responsabilidad |
|---------|----------------|
| `backend/app/services/memory_service.py` | Cargar y actualizar `agent_memory` por usuario |
| `frontend/src/pages/gerencial/GerencialPage.tsx` | Shell con tabs y routing por rol |
| `frontend/src/pages/gerencial/tabs/PanelGerenteTab.tsx` | KPIs + actividad + órdenes (Tab 1) |
| `frontend/src/pages/gerencial/tabs/DirectoraPlaneacionTab.tsx` | Lista tareas + gráficas (Tab 2) |
| `frontend/src/pages/gerencial/tabs/DesarrolloInnovacionTab.tsx` | Formulario + historial personal (Tab 3) |
| `frontend/public/manifest.json` | Metadata PWA |
| `frontend/public/sw.js` | Service Worker mínimo para trigger de instalación |

### Modificar
| Archivo | Qué cambia |
|---------|-----------|
| `backend/app/main.py` | + import gerencial_router, + create_gerencial_tables() en lifespan |
| `backend/app/gerencial_database.py` | + comentario bloque migración PostgreSQL |
| `backend/app/routers/agentes.py` | + endpoint /documentos/estado, + inyección de memoria en chat |
| `backend/app/routers/zymo.py` | + inyección de memoria en chat |
| `frontend/src/App.tsx` | + ruta /gerencial con PrivateRoute |
| `frontend/src/components/agent/AgentFloatingWindow.tsx` | + touch events en drag |
| `frontend/index.html` | + meta tags PWA |

---

## Task 1: Activar router y tablas gerenciales en main.py

**Files:**
- Modify: `backend/app/main.py:1-30` (imports) y `backend/app/main.py:215-227` (lifespan)

- [ ] **Step 1: Agregar import de gerencial_database y gerencial_router**

  Abrir `backend/app/main.py`. Justo después de la línea `from app.routers.zymo import router as zymo_router` (línea 29), agregar:

  ```python
  from app.gerencial_database import create_gerencial_tables
  from app.routers.gerencial import router as gerencial_router
  ```

- [ ] **Step 2: Llamar create_gerencial_tables() en el lifespan**

  En la función `lifespan` (línea 215), agregar `create_gerencial_tables()` justo después de `create_agent_tables()`:

  ```python
  async def lifespan(app: FastAPI):
      create_db_and_tables()
      _migrate_db()
      _seed_roles()
      _seed_areas_sedes()
      _seed_admin()
      create_oc_tables()
      _migrate_oc_db()
      _migrate_oc_cotizaciones()
      create_sgc_tables()
      create_financiero_tables()
      create_agent_tables()
      create_gerencial_tables()   # ← nuevo
      yield
  ```

- [ ] **Step 3: Registrar el router**

  Después de `app.include_router(zymo_router)` (línea 253), agregar:

  ```python
  app.include_router(gerencial_router)
  ```

- [ ] **Step 4: Verificar que el backend arranca sin errores**

  ```bash
  cd backend
  python -m uvicorn app.main:app --reload --port 8001
  ```

  Resultado esperado: servidor arranca, sin `ImportError` ni `OperationalError`. El log debe mostrar que las tablas `gerencial_tareas` y `gerencial_ordenes` se crean.

- [ ] **Step 5: Verificar endpoints disponibles**

  ```bash
  curl http://localhost:8001/openapi.json | python -m json.tool | grep "/api/gerencial"
  ```

  Resultado esperado: aparecen `/api/gerencial/tareas-dev`, `/api/gerencial/kpis`, `/api/gerencial/ordenes`, `/api/gerencial/estado-servidor`, `/api/gerencial/actividad`.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/app/main.py
  git commit -m "feat: activar módulo gerencial — router registrado y tablas en startup"
  ```

---

## Task 2: Documentar migración PostgreSQL en gerencial_database.py

**Files:**
- Modify: `backend/app/gerencial_database.py:1-10`

- [ ] **Step 1: Agregar bloque de documentación al inicio del archivo**

  Reemplazar el docstring actual del archivo (líneas 1-7) con la versión extendida:

  ```python
  """
  Base de datos del módulo gerencial — PostgreSQL.

  Es el piloto de migración del sistema a PostgreSQL. Contiene:
  - gerencial_tareas: tareas de Andrés/Andrea con descripción gerencial generada por ZYMO
  - gerencial_ordenes: órdenes directas del gerente a áreas

  ══════════════════════════════════════════════════════════════════
  MIGRACIÓN A POSTGRESQL — APLICA A TODOS LOS SCHEMAS DEL SISTEMA
  ══════════════════════════════════════════════════════════════════

  Cuando se migre este módulo a PostgreSQL, el mismo proceso aplica
  para TODOS los schemas. Orden recomendado:

    1. gerencial  → GERENCIAL_DATABASE_URL   (este archivo — piloto)
    2. agents     → AGENTS_DATABASE_URL      (agent_database.py)
    3. oc         → OC_DATABASE_URL          (oc_database.py)
    4. intranet   → DATABASE_URL             (database.py)

  Proceso por schema:
    1. Levantar contenedor PostgreSQL (ver docker-compose.yml)
    2. Cambiar la variable de entorno del schema en .env
    3. Reiniciar el servicio backend — las tablas se crean solas en lifespan
    4. Migrar datos históricos si aplica (script separado)

  No se requieren cambios en el código — solo en las variables de entorno.
  ══════════════════════════════════════════════════════════════════
  """
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/app/gerencial_database.py
  git commit -m "docs: documentar estrategia de migración PostgreSQL para todos los schemas"
  ```

---

## Task 3: Endpoint GET /api/agentes/documentos/estado

**Files:**
- Modify: `backend/app/routers/agentes.py`

- [ ] **Step 1: Agregar import de get_agents_db y desc**

  En la sección de imports de `agentes.py`, agregar:

  ```python
  from sqlmodel import Session, select, desc
  from app.agent_database import AgentDocumento, get_agents_db
  ```

- [ ] **Step 2: Agregar el endpoint**

  Al final del archivo `agentes.py`, antes del endpoint de chat o en la sección de documentos, agregar:

  ```python
  @router.get("/documentos/estado")
  def estado_documentos(
      current_user: User = Depends(get_current_user),
      db: Session = Depends(get_agents_db),
  ):
      """
      Estado del índice RAG: cuántos documentos están indexados y cuándo fue
      la última indexación. Útil para verificar que el piloto con Sonia está listo.
      """
      docs = db.exec(
          select(AgentDocumento).order_by(desc(AgentDocumento.indexado_at))
      ).all()
      ultima = docs[0].indexado_at.isoformat() if docs else None
      return {
          "total_documentos": len(docs),
          "ultima_indexacion": ultima,
          "listo_para_uso": len(docs) > 0,
          "documentos": [
              {
                  "nombre": d.nombre,
                  "tipo": d.tipo,
                  "area": d.area,
                  "chunks_count": d.chunks_count,
                  "indexado_at": d.indexado_at.isoformat(),
              }
              for d in docs
          ],
      }
  ```

- [ ] **Step 3: Verificar**

  Con el servidor corriendo:
  ```bash
  curl -H "Authorization: Bearer <token>" http://localhost:8001/api/agentes/documentos/estado
  ```

  Resultado esperado: `{"total_documentos": 0, "ultima_indexacion": null, "listo_para_uso": false, "documentos": []}`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/routers/agentes.py
  git commit -m "feat: endpoint /api/agentes/documentos/estado para piloto RAG Sonia"
  ```

---

## Task 4: Servicio de memoria persistente

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/memory_service.py`

- [ ] **Step 1: Crear el directorio services con __init__.py vacío**

  Crear `backend/app/services/__init__.py` como archivo vacío.

- [ ] **Step 2: Crear memory_service.py**

  Crear `backend/app/services/memory_service.py` con el siguiente contenido:

  ```python
  """
  Servicio de memoria persistente para agentes ZYMO.

  Carga y actualiza memorias de usuario en la tabla agent_memory.
  La memoria se inyecta como contexto en cada turno de chat, permitiendo
  que los agentes recuerden preferencias y patrones entre sesiones.

  Regla crítica: si hay conflicto entre memoria y dato real de BD → gana la BD.
  """
  import json
  import logging
  from datetime import datetime

  from sqlmodel import Session, select

  from app.agent_database import AgentMemory

  logger = logging.getLogger(__name__)


  def cargar_memoria_usuario(user_email: str, db: Session) -> str:
      """
      Carga las memorias del usuario y las formatea como bloque de contexto
      para inyectar antes del mensaje enviado a Gemini.

      Retorna string vacío si no hay memorias o si ocurre un error.
      """
      try:
          memorias = db.exec(
              select(AgentMemory).where(AgentMemory.user_email == user_email)
          ).all()
          if not memorias:
              return ""
          lineas = ["[MEMORIA DE SESIONES ANTERIORES — solo usa esto como contexto, la BD tiene la verdad]"]
          for m in memorias:
              try:
                  valor = json.loads(m.valor)
                  if isinstance(valor, str):
                      lineas.append(f"- {m.clave}: {valor}")
                  else:
                      lineas.append(f"- {m.clave}: {json.dumps(valor, ensure_ascii=False)}")
              except (json.JSONDecodeError, TypeError):
                  lineas.append(f"- {m.clave}: {m.valor}")
          return "\n".join(lineas)
      except Exception as e:
          logger.warning("Error cargando memoria para %s: %s", user_email, e)
          return ""


  def actualizar_contexto_login(user_email: str, contexto: dict, db: Session) -> None:
      """
      Actualiza (o crea) la entrada 'contexto_ultimo_login' para el usuario.
      Se llama al final de cada sesión de chat para que en el próximo login
      el agente sepa en qué estado quedó el área.
      """
      try:
          mem = db.exec(
              select(AgentMemory)
              .where(AgentMemory.user_email == user_email)
              .where(AgentMemory.clave == "contexto_ultimo_login")
          ).first()
          valor_json = json.dumps(contexto, ensure_ascii=False, default=str)
          if mem:
              mem.valor = valor_json
              mem.updated_at = datetime.utcnow()
          else:
              mem = AgentMemory(
                  user_email=user_email,
                  clave="contexto_ultimo_login",
                  valor=valor_json,
              )
          db.add(mem)
          db.commit()
      except Exception as e:
          logger.warning("Error actualizando contexto_login para %s: %s", user_email, e)
  ```

- [ ] **Step 3: Verificar que importa sin errores**

  ```bash
  cd backend
  python -c "from app.services.memory_service import cargar_memoria_usuario, actualizar_contexto_login; print('OK')"
  ```

  Resultado esperado: `OK`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/services/
  git commit -m "feat: servicio de memoria persistente para inyección de contexto en agentes"
  ```

---

## Task 5: Inyectar memoria en endpoints de chat

**Files:**
- Modify: `backend/app/routers/agentes.py`
- Modify: `backend/app/routers/zymo.py`

La estrategia: el router carga la memoria del usuario y la **prepende al mensaje** antes de enviarlo a Gemini. El log del markdown registra el mensaje original (limpio). Gemini recibe el mensaje enriquecido con contexto. No se modifica `base.py`.

- [ ] **Step 1: Actualizar imports en agentes.py**

  Agregar a los imports de `agentes.py` (si no están ya del Task 3):

  ```python
  from sqlmodel import Session, select, desc
  from app.agent_database import AgentDocumento, get_agents_db
  from app.services.memory_service import cargar_memoria_usuario, actualizar_contexto_login
  ```

- [ ] **Step 2: Modificar el endpoint chat_administrativo en agentes.py**

  Reemplazar la función `chat_administrativo` completa:

  ```python
  @router.post("/administrativo/chat")
  async def chat_administrativo(
      payload: ChatPayload,
      current_user: User = Depends(get_current_user),
      agents_db: Session = Depends(get_agents_db),
  ):
      """
      Chat con el Agente Administrativo ZYMO (streaming SSE).
      Inyecta memoria persistente del usuario como contexto antes de enviar a Gemini.
      """
      agente = _get_agente_administrativo()

      if not payload.session_id:
          agente.iniciar_sesion(user_id=current_user.id, user_email=current_user.email)

      # Cargar memoria — enriquecer mensaje para Gemini
      memoria_ctx = cargar_memoria_usuario(current_user.email, agents_db)
      mensaje_para_gemini = (
          f"{memoria_ctx}\n\n---\n{payload.mensaje}"
          if memoria_ctx
          else payload.mensaje
      )

      async def generar_stream():
          try:
              # Log del mensaje original (sin memoria — para logs limpios)
              agente.guardar_turno_md(current_user.email, "user", payload.mensaje)
              respuesta_completa = []
              async for chunk in agente.chat_stream(
                  mensaje_para_gemini,
                  historial=payload.historial,
              ):
                  respuesta_completa.append(chunk)
                  yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
              respuesta_texto = "".join(respuesta_completa)
              agente.guardar_turno_md(current_user.email, "agent", respuesta_texto)
              # Actualizar contexto del último login
              actualizar_contexto_login(
                  current_user.email,
                  {"ultima_consulta": payload.mensaje[:100], "agente": "administrativo"},
                  agents_db,
              )
              yield f"data: {json.dumps({'done': True})}\n\n"
          except Exception as e:
              logger.error("Error en stream administrativo: %s", e)
              yield f"data: {json.dumps({'error': str(e)})}\n\n"

      return StreamingResponse(
          generar_stream(),
          media_type="text/event-stream",
          headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
      )
  ```

- [ ] **Step 3: Actualizar imports en zymo.py**

  Agregar a los imports de `zymo.py`:

  ```python
  from sqlmodel import Session
  from app.agent_database import get_agents_db
  from app.services.memory_service import cargar_memoria_usuario, actualizar_contexto_login
  ```

- [ ] **Step 4: Modificar el endpoint chat_zymo en zymo.py**

  Reemplazar la función `chat_zymo` completa:

  ```python
  @router.post("/chat")
  async def chat_zymo(
      payload: ChatPayload,
      current_user: User = Depends(require_gerencial),
      agents_db: Session = Depends(get_agents_db),
  ):
      """
      Chat con ZYMO Core — streaming SSE.
      Inyecta memoria persistente del usuario como contexto antes de enviar a Gemini.
      """
      zymo = _get_zymo()

      if not payload.session_id:
          zymo.iniciar_sesion(user_id=current_user.id, user_email=current_user.email)

      # Cargar memoria — enriquecer mensaje para Gemini
      memoria_ctx = cargar_memoria_usuario(current_user.email, agents_db)
      mensaje_para_gemini = (
          f"{memoria_ctx}\n\n---\n{payload.mensaje}"
          if memoria_ctx
          else payload.mensaje
      )

      async def generar_stream():
          try:
              zymo.guardar_turno_md(current_user.email, "user", payload.mensaje)
              respuesta_completa = []
              async for chunk in zymo.chat_stream(
                  mensaje_para_gemini,
                  historial=payload.historial,
              ):
                  respuesta_completa.append(chunk)
                  yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
              respuesta_texto = "".join(respuesta_completa)
              zymo.guardar_turno_md(current_user.email, "agent", respuesta_texto)
              actualizar_contexto_login(
                  current_user.email,
                  {"ultima_consulta": payload.mensaje[:100], "agente": "zymo"},
                  agents_db,
              )
              yield f"data: {json.dumps({'done': True})}\n\n"
          except Exception as e:
              logger.error("Error en stream ZYMO: %s", e)
              yield f"data: {json.dumps({'error': str(e)})}\n\n"

      return StreamingResponse(
          generar_stream(),
          media_type="text/event-stream",
          headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
      )
  ```

- [ ] **Step 5: Verificar que el backend sigue arrancando**

  ```bash
  python -m uvicorn app.main:app --reload --port 8001
  ```

  Resultado esperado: sin errores de importación ni de sintaxis.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/app/routers/agentes.py backend/app/routers/zymo.py
  git commit -m "feat: inyección de memoria persistente en chat del Agente Administrativo y ZYMO"
  ```

---

## Task 6: Scaffold GerencialPage + ruta en App.tsx + instalar Recharts

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/gerencial/GerencialPage.tsx`

- [ ] **Step 1: Instalar recharts**

  ```bash
  cd frontend
  npm install recharts
  ```

  Resultado esperado: `recharts` aparece en `package.json` dependencies. Sin errores.

- [ ] **Step 2: Crear GerencialPage.tsx**

  Crear `frontend/src/pages/gerencial/GerencialPage.tsx`:

  ```tsx
  import { useState } from "react"
  import { Sidebar } from "@/components/layout/Sidebar"
  import { TopBar } from "@/components/layout/TopBar"
  import { useAuthStore } from "@/store/authStore"
  import { PanelGerenteTab } from "./tabs/PanelGerenteTab"
  import { DirectoraPlaneacionTab } from "./tabs/DirectoraPlaneacionTab"
  import { DesarrolloInnovacionTab } from "./tabs/DesarrolloInnovacionTab"

  const ROLES_GERENCIALES = new Set(["gerente", "admin"])

  type Tab = "gerente" | "directora" | "desarrollo"

  function tabInicial(role: string): Tab {
    if (ROLES_GERENCIALES.has(role)) return "gerente"
    return "desarrollo"
  }

  export function GerencialPage() {
    const user = useAuthStore((s) => s.user)
    const role = user?.role ?? ""
    const esGerencial = ROLES_GERENCIALES.has(role)

    const [activeTab, setActiveTab] = useState<Tab>(() => tabInicial(role))

    const tabs: { id: Tab; label: string; visible: boolean }[] = [
      { id: "gerente", label: "Panel Gerente", visible: esGerencial },
      { id: "directora", label: "Directora Planeación y Desarrollo", visible: esGerencial },
      { id: "desarrollo", label: "Desarrollo e Innovación & Planeación y Consultoría", visible: true },
    ]

    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar title="Módulo Gerencial" />

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white px-6">
            <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
              {tabs
                .filter((t) => t.visible)
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors
                      ${
                        activeTab === tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }
                    `}
                  >
                    {tab.id === "gerente" ? (
                      <PanelGerenteTabLabel />
                    ) : (
                      tab.label
                    )}
                  </button>
                ))}
            </nav>
          </div>

          {/* Contenido del tab activo */}
          <main className="flex-1 overflow-y-auto">
            {activeTab === "gerente" && <PanelGerenteTab />}
            {activeTab === "directora" && <DirectoraPlaneacionTab />}
            {activeTab === "desarrollo" && <DesarrolloInnovacionTab />}
          </main>
        </div>
      </div>
    )
  }

  /**
   * Label del tab Panel Gerente con badge de reportes no leídos.
   * Hace fetch a /api/zymo/reportes para contar los no leídos.
   */
  function PanelGerenteTabLabel() {
    const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"
    const token = useAuthStore((s) => s.token)
    const [unread, setUnread] = useState<number | null>(null)

    // Fetch al montar — sin tanstack/query para mantener el componente simple
    useState(() => {
      fetch(`${BASE_URL}/api/zymo/reportes?destinatario=gerente`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data: { leido: boolean }[]) => {
          if (Array.isArray(data)) {
            setUnread(data.filter((r) => !r.leido).length)
          }
        })
        .catch(() => {})
    })

    return (
      <span className="flex items-center gap-1.5">
        Panel Gerente
        {unread !== null && unread > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </span>
    )
  }
  ```

- [ ] **Step 3: Agregar la ruta en App.tsx**

  En `frontend/src/App.tsx`, agregar el import:

  ```tsx
  import { GerencialPage } from "@/pages/gerencial/GerencialPage"
  ```

  Y agregar la ruta antes del wildcard `<Route path="*" ...>`:

  ```tsx
  {/* Módulo Gerencial — accesible para cualquier usuario autenticado */}
  <Route
    path="/gerencial"
    element={
      <PrivateRoute>
        <GerencialPage />
      </PrivateRoute>
    }
  />
  ```

- [ ] **Step 4: Verificar que el frontend compila**

  ```bash
  cd frontend
  npm run build
  ```

  Resultado esperado: build exitoso. (Los tabs mostrarán "cargando" porque los subcomponentes aún no existen — crearlos en los tasks siguientes.)

  > Nota: Si el build falla por imports de los tabs no creados aún, crear archivos placeholder temporales:
  > `frontend/src/pages/gerencial/tabs/PanelGerenteTab.tsx` → `export function PanelGerenteTab() { return <div>Panel Gerente</div> }`
  > `frontend/src/pages/gerencial/tabs/DirectoraPlaneacionTab.tsx` → `export function DirectoraPlaneacionTab() { return <div>Directora</div> }`
  > `frontend/src/pages/gerencial/tabs/DesarrolloInnovacionTab.tsx` → `export function DesarrolloInnovacionTab() { return <div>Desarrollo</div> }`

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/gerencial/ frontend/src/App.tsx frontend/package.json frontend/package-lock.json
  git commit -m "feat: scaffold GerencialPage con tabs por rol + ruta /gerencial + recharts"
  ```

---

## Task 7: Tab 1 — Panel Gerente

**Files:**
- Create: `frontend/src/pages/gerencial/tabs/PanelGerenteTab.tsx`

- [ ] **Step 1: Crear PanelGerenteTab.tsx**

  ```tsx
  import { useState, useEffect } from "react"
  import { useAuthStore } from "@/store/authStore"

  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

  interface GerencialKPIs {
    timestamp: string
    oc: {
      total_activas: number
      por_estado: Record<string, number>
      alertas: string[]
    }
    desarrollo: {
      tareas_completadas: number
      tareas_en_progreso: number
      tareas_bloqueadas: number
      tiempo_total_invertido_horas: number
    }
    estado_general: "ok" | "alertas_activas"
  }

  interface ActividadItem {
    tipo: string
    timestamp: string
    descripcion: string
    estado: string
    etiqueta: string
  }

  interface OrdenRead {
    id: string
    creada_por_nombre: string
    destinatario_nombre: string
    destinatario_area: string
    titulo: string
    descripcion: string | null
    estado: string
    created_at: string
  }

  interface UserItem {
    id: number
    full_name: string
    email: string
    area: string | null
  }

  function authHeaders(token: string | null): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  export function PanelGerenteTab() {
    const token = useAuthStore((s) => s.token)
    const user = useAuthStore((s) => s.user)
    const [kpis, setKpis] = useState<GerencialKPIs | null>(null)
    const [actividad, setActividad] = useState<ActividadItem[]>([])
    const [ordenes, setOrdenes] = useState<OrdenRead[]>([])
    const [usuarios, setUsuarios] = useState<UserItem[]>([])
    const [loading, setLoading] = useState(true)
    const [nuevaOrden, setNuevaOrden] = useState({ titulo: "", descripcion: "", destinatario_id: "" })
    const [creandoOrden, setCreandoOrden] = useState(false)
    const [mostrarFormOrden, setMostrarFormOrden] = useState(false)

    const headers = authHeaders(token)

    useEffect(() => {
      Promise.all([
        fetch(`${BASE_URL}/api/gerencial/kpis`, { headers }).then((r) => r.json()),
        fetch(`${BASE_URL}/api/gerencial/actividad?limite=15`, { headers }).then((r) => r.json()),
        fetch(`${BASE_URL}/api/gerencial/ordenes`, { headers }).then((r) => r.json()),
        fetch(`${BASE_URL}/api/users`, { headers }).then((r) => r.json()),
      ])
        .then(([k, a, o, u]) => {
          setKpis(k)
          setActividad(Array.isArray(a) ? a : [])
          setOrdenes(Array.isArray(o) ? o : [])
          setUsuarios(Array.isArray(u) ? u : [])
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }, [])

    async function handleCrearOrden(e: React.FormEvent) {
      e.preventDefault()
      if (!nuevaOrden.titulo || !nuevaOrden.destinatario_id) return
      setCreandoOrden(true)
      try {
        const res = await fetch(`${BASE_URL}/api/gerencial/ordenes`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            titulo: nuevaOrden.titulo,
            descripcion: nuevaOrden.descripcion || null,
            destinatario_id: parseInt(nuevaOrden.destinatario_id),
          }),
        })
        if (res.ok) {
          const orden: OrdenRead = await res.json()
          setOrdenes((prev) => [orden, ...prev])
          setNuevaOrden({ titulo: "", descripcion: "", destinatario_id: "" })
          setMostrarFormOrden(false)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setCreandoOrden(false)
      }
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          Cargando datos...
        </div>
      )
    }

    return (
      <div className="p-6 space-y-6">
        {/* KPIs */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Estado de la empresa
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPICard
              label="OC Activas"
              value={kpis?.oc.total_activas ?? 0}
              alert={(kpis?.oc.alertas.length ?? 0) > 0}
            />
            <KPICard
              label="Pendientes aprobación"
              value={kpis?.oc.por_estado?.pendiente_aprobacion ?? 0}
              alert={(kpis?.oc.por_estado?.pendiente_aprobacion ?? 0) > 0}
            />
            <KPICard
              label="Tareas en progreso"
              value={kpis?.desarrollo.tareas_en_progreso ?? 0}
            />
            <KPICard
              label="Tareas bloqueadas"
              value={kpis?.desarrollo.tareas_bloqueadas ?? 0}
              alert={(kpis?.desarrollo.tareas_bloqueadas ?? 0) > 0}
            />
          </div>
          {(kpis?.oc.alertas.length ?? 0) > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              {kpis!.oc.alertas.map((a, i) => (
                <p key={i} className="text-sm text-red-700">🔴 {a}</p>
              ))}
            </div>
          )}
        </section>

        {/* Órdenes directas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Órdenes directas
            </h2>
            <button
              onClick={() => setMostrarFormOrden((v) => !v)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              {mostrarFormOrden ? "Cancelar" : "+ Nueva orden"}
            </button>
          </div>

          {mostrarFormOrden && (
            <form onSubmit={handleCrearOrden} className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Destinatario</label>
                <select
                  required
                  value={nuevaOrden.destinatario_id}
                  onChange={(e) => setNuevaOrden((p) => ({ ...p, destinatario_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Seleccionar persona...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} {u.area ? `— ${u.area}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Título de la tarea *</label>
                <input
                  required
                  value={nuevaOrden.titulo}
                  onChange={(e) => setNuevaOrden((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ej: Revisar contrato con Proveedor XYZ"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  rows={2}
                  value={nuevaOrden.descripcion}
                  onChange={(e) => setNuevaOrden((p) => ({ ...p, descripcion: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <button
                type="submit"
                disabled={creandoOrden}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creandoOrden ? "Enviando..." : "Enviar orden"}
              </button>
            </form>
          )}

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {ordenes.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">Sin órdenes activas</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Para</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Tarea</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Estado</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.slice(0, 10).map((o) => (
                    <tr key={o.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 font-medium text-gray-800">{o.destinatario_nombre}</td>
                      <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{o.titulo}</td>
                      <td className="px-4 py-2">
                        <EstadoBadge estado={o.estado} />
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">
                        {new Date(o.created_at).toLocaleDateString("es-CO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Feed de actividad */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Actividad reciente
          </h2>
          <div className="space-y-2">
            {actividad.length === 0 ? (
              <p className="text-sm text-gray-400">Sin actividad reciente</p>
            ) : (
              actividad.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-white border border-gray-100 px-4 py-3">
                  <span className="text-lg shrink-0">
                    {item.tipo === "tarea_dev" ? "💻" : "🤖"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.descripcion}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.timestamp).toLocaleString("es-CO")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    )
  }

  function KPICard({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
    return (
      <div className={`rounded-xl border p-4 bg-white ${alert ? "border-red-200" : "border-gray-200"}`}>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      </div>
    )
  }

  function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, string> = {
      pendiente: "bg-yellow-100 text-yellow-700",
      en_progreso: "bg-blue-100 text-blue-700",
      completada: "bg-green-100 text-green-700",
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}>
        {estado.replace("_", " ")}
      </span>
    )
  }
  ```

- [ ] **Step 2: Verificar que el frontend compila**

  ```bash
  cd frontend && npm run build
  ```

  Resultado esperado: build exitoso sin errores de TypeScript.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/gerencial/tabs/PanelGerenteTab.tsx
  git commit -m "feat: Tab 1 Panel Gerente — KPIs, actividad, órdenes directas"
  ```

---

## Task 8: Tab 2 — Directora Planeación y Desarrollo

**Files:**
- Create: `frontend/src/pages/gerencial/tabs/DirectoraPlaneacionTab.tsx`

- [ ] **Step 1: Crear DirectoraPlaneacionTab.tsx**

  ```tsx
  import { useState, useEffect, useMemo } from "react"
  import { useAuthStore } from "@/store/authStore"
  import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  } from "recharts"

  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

  interface TareaRead {
    id: string
    subido_por_nombre: string
    fecha: string
    hora_inicio: string | null
    hora_cierre: string | null
    tiempo_total_minutos: number | null
    etiqueta: string
    plataforma: string
    titulo: string
    descripcion_tecnica: string
    descripcion_gerencial: string | null
    impacto: string | null
    estado: string
    created_at: string
  }

  const COLORES_ETIQUETA: Record<string, string> = {
    desarrollos: "#3B82F6",
    actualizaciones: "#10B981",
    auditorias: "#F59E0B",
    implementacion_okr: "#8B5CF6",
    tareas_diarias: "#6B7280",
  }

  const COLORES_ESTADO = {
    completada: "#10B981",
    en_progreso: "#3B82F6",
    bloqueada: "#EF4444",
  }

  function authHeaders(token: string | null): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  export function DirectoraPlaneacionTab() {
    const token = useAuthStore((s) => s.token)
    const [tareas, setTareas] = useState<TareaRead[]>([])
    const [loading, setLoading] = useState(true)
    const [filtroEstado, setFiltroEstado] = useState("")
    const [filtroEtiqueta, setFiltroEtiqueta] = useState("")
    const [filtroPlataforma, setFiltroPlataforma] = useState("")

    const headers = authHeaders(token)

    useEffect(() => {
      const params = new URLSearchParams({ limit: "200" })
      if (filtroEstado) params.set("estado", filtroEstado)
      if (filtroEtiqueta) params.set("etiqueta", filtroEtiqueta)
      if (filtroPlataforma) params.set("plataforma", filtroPlataforma)
      fetch(`${BASE_URL}/api/gerencial/tareas-dev?${params}`, { headers })
        .then((r) => r.json())
        .then((data) => setTareas(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setLoading(false))
    }, [filtroEstado, filtroEtiqueta, filtroPlataforma])

    // ── Datos para gráficas ──────────────────────────────────────────────────

    const dataPorEstado = useMemo(() => [
      { name: "Completadas", value: tareas.filter((t) => t.estado === "completada").length, fill: COLORES_ESTADO.completada },
      { name: "En progreso", value: tareas.filter((t) => t.estado === "en_progreso").length, fill: COLORES_ESTADO.en_progreso },
      { name: "Bloqueadas", value: tareas.filter((t) => t.estado === "bloqueada").length, fill: COLORES_ESTADO.bloqueada },
    ], [tareas])

    const dataPorEtiqueta = useMemo(() => {
      const conteo: Record<string, number> = {}
      tareas.forEach((t) => { conteo[t.etiqueta] = (conteo[t.etiqueta] ?? 0) + 1 })
      return Object.entries(conteo).map(([name, value]) => ({ name, value }))
    }, [tareas])

    const dataPorPlataforma = useMemo(() => {
      const minutos: Record<string, number> = {}
      tareas.forEach((t) => {
        minutos[t.plataforma] = (minutos[t.plataforma] ?? 0) + (t.tiempo_total_minutos ?? 0)
      })
      return Object.entries(minutos).map(([name, value]) => ({
        name,
        horas: Math.round(value / 60 * 10) / 10,
      }))
    }, [tareas])

    const dataPorSemana = useMemo(() => {
      const semanas: Record<string, number> = {}
      const ahora = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ahora)
        d.setDate(d.getDate() - i * 7)
        const key = `Sem ${d.toLocaleDateString("es-CO", { month: "short", day: "numeric" })}`
        semanas[key] = 0
      }
      tareas
        .filter((t) => t.estado === "completada")
        .forEach((t) => {
          const fecha = new Date(t.fecha)
          const diffDias = Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDias <= 42) {
            const semIdx = Math.floor(diffDias / 7)
            const keys = Object.keys(semanas)
            const key = keys[5 - semIdx]
            if (key) semanas[key] = (semanas[key] ?? 0) + 1
          }
        })
      return Object.entries(semanas).map(([name, completadas]) => ({ name, completadas }))
    }, [tareas])

    const bloqueadas = tareas.filter((t) => t.estado === "bloqueada")

    if (loading) {
      return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando datos...</div>
    }

    return (
      <div className="p-6 space-y-6">
        {/* Alerta bloqueadas */}
        {bloqueadas.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">
              🔴 {bloqueadas.length} tarea{bloqueadas.length > 1 ? "s" : ""} bloqueada{bloqueadas.length > 1 ? "s" : ""}
            </p>
            {bloqueadas.map((t) => (
              <p key={t.id} className="text-xs text-red-600 mt-1">— {t.titulo} ({t.subido_por_nombre})</p>
            ))}
          </div>
        )}

        {/* Gráficas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Tareas completadas por semana">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataPorSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completadas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribución por etiqueta">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={dataPorEtiqueta}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {dataPorEtiqueta.map((entry, index) => (
                    <Cell key={index} fill={COLORES_ETIQUETA[entry.name] ?? "#9CA3AF"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Horas invertidas por plataforma">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataPorPlataforma} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v) => [`${v}h`, "Horas"]} />
                <Bar dataKey="horas" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Estado actual del equipo">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataPorEstado}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {dataPorEstado.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Todos los estados</option>
            <option value="completada">Completada</option>
            <option value="en_progreso">En progreso</option>
            <option value="bloqueada">Bloqueada</option>
          </select>
          <select
            value={filtroEtiqueta}
            onChange={(e) => setFiltroEtiqueta(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Todas las etiquetas</option>
            <option value="desarrollos">Desarrollos</option>
            <option value="actualizaciones">Actualizaciones</option>
            <option value="auditorias">Auditorías</option>
            <option value="implementacion_okr">Implementación OKR</option>
            <option value="tareas_diarias">Tareas diarias</option>
          </select>
          <select
            value={filtroPlataforma}
            onChange={(e) => setFiltroPlataforma(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Todas las plataformas</option>
            <option value="logimat1">Logimat 1</option>
            <option value="logimat2">Logimat 2</option>
            <option value="imccargo">IMCCARGO</option>
            <option value="imcdeposito">IMCDEPÓSITO</option>
            <option value="transversal">Transversal</option>
          </select>
        </div>

        {/* Lista de tareas */}
        <div className="space-y-3">
          {tareas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin tareas con estos filtros</p>
          ) : (
            tareas.map((t) => (
              <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{t.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.subido_por_nombre} · {t.plataforma} · {t.fecha}
                      {t.tiempo_total_minutos && ` · ${Math.round(t.tiempo_total_minutos / 60 * 10) / 10}h`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {t.etiqueta.replace("_", " ")}
                    </span>
                    <EstadoBadge estado={t.estado} />
                  </div>
                </div>
                {t.descripcion_gerencial && (
                  <p className="text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 border-l-2 border-blue-400">
                    <span className="font-medium text-blue-600">ZYMO: </span>{t.descripcion_gerencial}
                  </p>
                )}
                {t.impacto && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    📈 {t.impacto}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
        {children}
      </div>
    )
  }

  function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, string> = {
      completada: "bg-green-100 text-green-700",
      en_progreso: "bg-blue-100 text-blue-700",
      bloqueada: "bg-red-100 text-red-700",
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}>
        {estado.replace("_", " ")}
      </span>
    )
  }
  ```

- [ ] **Step 2: Verificar build**

  ```bash
  cd frontend && npm run build
  ```

  Resultado esperado: sin errores TypeScript.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/gerencial/tabs/DirectoraPlaneacionTab.tsx
  git commit -m "feat: Tab 2 Directora Planeación — lista tareas + 4 gráficas recharts"
  ```

---

## Task 9: Tab 3 — Desarrollo e Innovación & Planeación y Consultoría

**Files:**
- Create: `frontend/src/pages/gerencial/tabs/DesarrolloInnovacionTab.tsx`

- [ ] **Step 1: Crear DesarrolloInnovacionTab.tsx**

  ```tsx
  import { useState, useEffect } from "react"
  import { useAuthStore } from "@/store/authStore"

  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001"

  interface TareaRead {
    id: string
    subido_por_nombre: string
    fecha: string
    hora_inicio: string | null
    hora_cierre: string | null
    tiempo_total_minutos: number | null
    etiqueta: string
    plataforma: string
    titulo: string
    descripcion_tecnica: string
    descripcion_gerencial: string | null
    impacto: string | null
    estado: string
    created_at: string
  }

  interface FormState {
    titulo: string
    descripcion_tecnica: string
    etiqueta: string
    plataforma: string
    estado: string
    fecha: string
    hora_inicio: string
    hora_cierre: string
  }

  const FORM_INICIAL: FormState = {
    titulo: "",
    descripcion_tecnica: "",
    etiqueta: "tareas_diarias",
    plataforma: "transversal",
    estado: "completada",
    fecha: new Date().toISOString().split("T")[0],
    hora_inicio: "",
    hora_cierre: "",
  }

  function authHeaders(token: string | null): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  function minutosATexto(min: number): string {
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  export function DesarrolloInnovacionTab() {
    const token = useAuthStore((s) => s.token)
    const user = useAuthStore((s) => s.user)
    const [form, setForm] = useState<FormState>(FORM_INICIAL)
    const [enviando, setEnviando] = useState(false)
    const [errorForm, setErrorForm] = useState<string | null>(null)
    const [exito, setExito] = useState(false)
    const [tareas, setTareas] = useState<TareaRead[]>([])
    const [loadingTareas, setLoadingTareas] = useState(true)

    const headers = authHeaders(token)

    // Calcular tiempo automáticamente cuando cambian las horas
    const tiempoCalculado = (() => {
      if (!form.hora_inicio || !form.hora_cierre) return null
      const [hi, mi] = form.hora_inicio.split(":").map(Number)
      const [hc, mc] = form.hora_cierre.split(":").map(Number)
      const min = (hc * 60 + mc) - (hi * 60 + mi)
      return min > 0 ? min : null
    })()

    function cargarTareas() {
      fetch(`${BASE_URL}/api/gerencial/tareas-dev?limit=50`, { headers })
        .then((r) => r.json())
        .then((data) => setTareas(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setLoadingTareas(false))
    }

    useEffect(() => { cargarTareas() }, [])

    function set(field: keyof FormState, value: string) {
      setForm((p) => ({ ...p, [field]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      if (!form.titulo || !form.descripcion_tecnica) {
        setErrorForm("Título y descripción técnica son obligatorios.")
        return
      }
      setErrorForm(null)
      setEnviando(true)

      const body: Record<string, unknown> = {
        titulo: form.titulo,
        descripcion_tecnica: form.descripcion_tecnica,
        etiqueta: form.etiqueta,
        plataforma: form.plataforma,
        estado: form.estado,
        fecha: form.fecha,
      }
      if (form.hora_inicio && form.hora_cierre) {
        body.hora_inicio = `${form.fecha}T${form.hora_inicio}:00`
        body.hora_cierre = `${form.fecha}T${form.hora_cierre}:00`
      }

      try {
        const res = await fetch(`${BASE_URL}/api/gerencial/tareas-dev`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail ?? "Error al guardar")
        }
        const nueva: TareaRead = await res.json()
        setTareas((prev) => [nueva, ...prev])
        setForm(FORM_INICIAL)
        setExito(true)
        setTimeout(() => setExito(false), 3000)
      } catch (err: unknown) {
        setErrorForm(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setEnviando(false)
      }
    }

    // Métricas personales
    const misTareas = tareas.filter((t) => t.subido_por_nombre === (user?.full_name ?? user?.email))
    const totalHoras = misTareas.reduce((acc, t) => acc + (t.tiempo_total_minutos ?? 0), 0) / 60
    const completadas = misTareas.filter((t) => t.estado === "completada").length
    const porEtiqueta: Record<string, number> = {}
    misTareas.forEach((t) => { porEtiqueta[t.etiqueta] = (porEtiqueta[t.etiqueta] ?? 0) + 1 })

    return (
      <div className="p-6 space-y-6">
        {/* Métricas personales */}
        <section className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{misTareas.length}</p>
            <p className="text-xs text-gray-500 mt-1">Tareas registradas</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completadas}</p>
            <p className="text-xs text-gray-500 mt-1">Completadas</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{Math.round(totalHoras * 10) / 10}h</p>
            <p className="text-xs text-gray-500 mt-1">Horas registradas</p>
          </div>
        </section>

        {/* Formulario */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ¿Qué hice hoy?
          </h2>
          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            {/* Fila 1: fecha + estado */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => set("fecha", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => set("estado", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="completada">Completada</option>
                  <option value="en_progreso">En progreso</option>
                  <option value="bloqueada">Bloqueada</option>
                </select>
              </div>
            </div>

            {/* Fila 2: hora inicio + hora cierre + tiempo calculado */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hora inicio</label>
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => set("hora_inicio", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hora cierre</label>
                <input
                  type="time"
                  value={form.hora_cierre}
                  onChange={(e) => set("hora_cierre", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tiempo total</label>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  {tiempoCalculado ? minutosATexto(tiempoCalculado) : "—"}
                </div>
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
              <input
                required
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ej: Implementé módulo de reportes gerenciales"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {/* Descripción técnica */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripción técnica *</label>
              <textarea
                required
                rows={3}
                value={form.descripcion_tecnica}
                onChange={(e) => set("descripcion_tecnica", e.target.value)}
                placeholder="Detalla qué hiciste, qué tecnologías usaste, qué problema resolviste..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {/* Etiqueta + Plataforma */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Etiqueta</label>
                <select
                  value={form.etiqueta}
                  onChange={(e) => set("etiqueta", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="desarrollos">Desarrollos</option>
                  <option value="actualizaciones">Actualizaciones</option>
                  <option value="auditorias">Auditorías</option>
                  <option value="implementacion_okr">Implementación OKR</option>
                  <option value="tareas_diarias">Tareas diarias</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plataforma</label>
                <select
                  value={form.plataforma}
                  onChange={(e) => set("plataforma", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="transversal">Transversal</option>
                  <option value="logimat1">Logimat 1</option>
                  <option value="logimat2">Logimat 2</option>
                  <option value="imccargo">IMCCARGO</option>
                  <option value="imcdeposito">IMCDEPÓSITO</option>
                </select>
              </div>
            </div>

            {errorForm && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorForm}</p>
            )}
            {exito && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                ✅ Tarea registrada. ZYMO generará la descripción gerencial en breve.
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {enviando ? "Guardando..." : "Registrar tarea"}
            </button>
          </form>
        </section>

        {/* Historial */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Historial de tareas
          </h2>
          {loadingTareas ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : tareas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin tareas registradas</p>
          ) : (
            <div className="space-y-3">
              {tareas.map((t) => (
                <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{t.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.subido_por_nombre} · {t.fecha}
                        {t.tiempo_total_minutos ? ` · ${minutosATexto(t.tiempo_total_minutos)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                        {t.plataforma}
                      </span>
                      <EstadoBadge estado={t.estado} />
                    </div>
                  </div>
                  {t.descripcion_gerencial && (
                    <p className="text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2 mt-2 border-l-2 border-blue-400">
                      <span className="font-medium text-blue-600">ZYMO: </span>{t.descripcion_gerencial}
                    </p>
                  )}
                  {t.impacto && (
                    <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mt-1">
                      📈 {t.impacto}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, string> = {
      completada: "bg-green-100 text-green-700",
      en_progreso: "bg-blue-100 text-blue-700",
      bloqueada: "bg-red-100 text-red-700",
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}>
        {estado.replace("_", " ")}
      </span>
    )
  }
  ```

- [ ] **Step 2: Verificar build**

  ```bash
  cd frontend && npm run build
  ```

  Resultado esperado: sin errores TypeScript.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/gerencial/tabs/DesarrolloInnovacionTab.tsx
  git commit -m "feat: Tab 3 Desarrollo e Innovación — formulario tareas + historial + métricas"
  ```

---

## Task 10: PWA — instalable en móvil

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/sw.js`
- Modify: `frontend/index.html`

- [ ] **Step 1: Crear manifest.json**

  Crear `frontend/public/manifest.json`:

  ```json
  {
    "name": "ZYMO Intranet",
    "short_name": "ZYMO",
    "description": "Intranet empresarial Grupo ZYMO",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#1D4ED8",
    "orientation": "portrait-primary",
    "icons": [
      {
        "src": "/favicon.svg",
        "sizes": "any",
        "type": "image/svg+xml",
        "purpose": "any maskable"
      }
    ]
  }
  ```

- [ ] **Step 2: Crear sw.js (Service Worker mínimo)**

  Crear `frontend/public/sw.js`:

  ```javascript
  // Service Worker mínimo — solo activa el trigger de instalación PWA.
  // No implementa cache offline. Las solicitudes siempre van a la red.
  self.addEventListener("install", () => {
    self.skipWaiting()
  })
  self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim())
  })
  self.addEventListener("fetch", (event) => {
    event.respondWith(fetch(event.request))
  })
  ```

- [ ] **Step 3: Actualizar index.html**

  Reemplazar el contenido de `frontend/index.html` con:

  ```html
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#1D4ED8" />
      <meta name="description" content="Intranet empresarial Grupo ZYMO" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="ZYMO" />
      <link rel="apple-touch-icon" href="/favicon.svg" />
      <link rel="manifest" href="/manifest.json" />
      <title>ZYMO Intranet</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
      <script>
        if ("serviceWorker" in navigator) {
          window.addEventListener("load", () => {
            navigator.serviceWorker.register("/sw.js").catch(() => {})
          })
        }
      </script>
    </body>
  </html>
  ```

- [ ] **Step 4: Verificar build**

  ```bash
  cd frontend && npm run build
  ```

  Resultado esperado: build exitoso. El archivo `dist/manifest.json` y `dist/sw.js` deben existir.

  ```bash
  ls frontend/dist/manifest.json frontend/dist/sw.js
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/public/manifest.json frontend/public/sw.js frontend/index.html
  git commit -m "feat: PWA — manifest, service worker y meta tags para instalación en móvil"
  ```

---

## Task 11: Touch events en AgentFloatingWindow

**Files:**
- Modify: `frontend/src/components/agent/AgentFloatingWindow.tsx`

- [ ] **Step 1: Agregar handlers de touch**

  En `AgentFloatingWindow.tsx`, después del bloque `// ── Drag` (línea 51), agregar los handlers de touch:

  ```tsx
  // ── Touch drag (móvil) ───────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!windowRef.current || e.touches.length !== 1) return
    const touch = e.touches[0]
    const rect = windowRef.current.getBoundingClientRect()
    dragging.current = true
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
    // No llamar e.preventDefault() aquí — lo hace el listener pasivo en useEffect
  }, [])
  ```

- [ ] **Step 2: Agregar listeners de touch en el useEffect de drag**

  Reemplazar el `useEffect` del drag (líneas 64-81) con la versión que incluye touch:

  ```tsx
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }
    function onMouseUp() {
      dragging.current = false
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current || e.touches.length !== 1) return
      e.preventDefault() // Evitar scroll mientras arrastra
      const touch = e.touches[0]
      setPos({
        x: touch.clientX - dragOffset.current.x,
        y: touch.clientY - dragOffset.current.y,
      })
    }
    function onTouchEnd() {
      dragging.current = false
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [])
  ```

- [ ] **Step 3: Agregar onTouchStart al header del botón minimizado**

  En el render minimizado (botón con `onMouseDown={handleMouseDown}`), agregar `onTouchStart`:

  ```tsx
  <button
    onMouseDown={handleMouseDown}
    onTouchStart={handleTouchStart}
    onClick={() => setExpanded(true)}
    ...
  >
  ```

- [ ] **Step 4: Agregar onTouchStart al header expandido**

  En el header expandido (div con `onMouseDown={handleMouseDown}`), agregar `onTouchStart`:

  ```tsx
  <div
    onMouseDown={handleMouseDown}
    onTouchStart={handleTouchStart}
    className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 rounded-t-2xl bg-brand-blue cursor-grab active:cursor-grabbing"
  >
  ```

- [ ] **Step 5: Verificar build**

  ```bash
  cd frontend && npm run build
  ```

  Resultado esperado: sin errores TypeScript.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/components/agent/AgentFloatingWindow.tsx
  git commit -m "feat: touch drag en agente flotante para uso en móvil"
  ```

---

## Task 12: Markdown de configuración del servidor

**Files:**
- Create: `SERVIDOR_CONFIGURACION.md` (en la raíz del proyecto — no sube a git, agregar a .gitignore)

- [ ] **Step 1: Agregar SERVIDOR_CONFIGURACION.md al .gitignore**

  Agregar al final de `.gitignore`:

  ```
  # Guía de configuración del servidor (contiene rutas e instrucciones internas)
  SERVIDOR_CONFIGURACION.md
  ```

- [ ] **Step 2: Crear SERVIDOR_CONFIGURACION.md**

  Crear `SERVIDOR_CONFIGURACION.md` en la raíz del proyecto:

  ```markdown
  # Guía de Configuración del Servidor — ZYMO Intranet
  > Para uso interno. No subir a git.
  > Actualizado: 2026-04-21 | Semana 2

  ---

  ## 1. Variables de entorno — qué configurar y dónde

  El archivo de configuración es `backend/.env`.
  Si no existe, copiar `backend/.env.example` y completar los valores.

  ### 1.1 Variables nuevas en Semana 2

  ```env
  # ── Módulo Gerencial (SQLite por defecto, cambiar a PostgreSQL cuando estés listo) ──
  GERENCIAL_DATABASE_URL=sqlite:///./data/gerencial.db

  # ── API Keys de los Agentes ──
  # Key de la cuenta Google #1 → para ZYMO (agente gerencial)
  GEMINI_API_KEY_GERENCIAL=AIza...

  # Key de la cuenta Google #2 → para el Agente Administrativo (Sonia)
  GEMINI_API_KEY_ADMINISTRATIVO=AIza...
  ```

  ### 1.2 Dónde obtener las API Keys de Gemini

  1. Ir a https://aistudio.google.com/app/apikey
  2. Iniciar sesión con la cuenta Google #1 (para ZYMO)
  3. Click "Create API key" → copiar el valor → pegar en `GEMINI_API_KEY_GERENCIAL`
  4. Cerrar sesión → iniciar con la cuenta Google #2
  5. Repetir → pegar en `GEMINI_API_KEY_ADMINISTRATIVO`

  > Por qué 2 keys: cada cuenta tiene 1M tokens/día gratuitos → 2M/día totales.
  > Si una se agota, la otra sigue funcionando.

  ### 1.3 Variables opcionales (ya configuradas, verificar)

  ```env
  # Base de datos principal (SQLite)
  DATABASE_URL=sqlite:///./data/intranet.db
  OC_DATABASE_URL=sqlite:///./data/oc.db
  AGENTS_DATABASE_URL=sqlite:///./data/agents.db

  # SMTP para emails (dejar vacío si no hay servidor de correo)
  SMTP_USER=
  SMTP_PASSWORD=
  SMTP_FROM=
  EMAIL_DIRECTORA=

  # Dirección del servidor (para links en emails)
  INTRANET_URL=http://<ip-del-servidor>:81
  ```

  ---

  ## 2. Levantar los servicios

  ```bash
  # En el servidor, desde la raíz del proyecto:
  docker compose up -d --build
  ```

  Servicios que se levantan:
  | Servicio | Puerto | Descripción |
  |----------|--------|-------------|
  | `backend` | 8001 | API FastAPI |
  | `frontend` | 81 | React (Nginx) |
  | `zymo-worker` | — | APScheduler: rondas cada 2h, reportes diarios |

  Verificar que todos corren:
  ```bash
  docker compose ps
  ```
  Resultado esperado: los 3 servicios con estado `Up`.

  ---

  ## 3. Piloto con Sonia — RAG de documentos

  ### Paso a paso para indexar documentos

  1. **Copiar documentos** al volumen del servidor:
     ```bash
     # Desde tu máquina local al servidor:
     scp /ruta/local/documento.pdf usuario@servidor:/ruta/al/volumen/agent_docs/

     # O si tienes acceso directo al servidor:
     cp /origen/documento.pdf /var/lib/docker/volumes/zymo_backend_data/_data/agent_docs/
     ```
     Formatos aceptados: `.pdf`, `.docx`, `.md`, `.txt`

  2. **Disparar la indexación:**
     ```bash
     curl -X POST http://localhost:8001/api/agentes/documentos/indexar \
       -H "Authorization: Bearer <token-admin>"
     ```

  3. **Verificar que quedó listo:**
     ```bash
     curl http://localhost:8001/api/agentes/documentos/estado \
       -H "Authorization: Bearer <token-admin>"
     ```
     Resultado esperado:
     ```json
     { "total_documentos": N, "listo_para_uso": true, "ultima_indexacion": "..." }
     ```

  4. **Sonia puede empezar a usar el agente** — preguntar sobre los documentos indexados.

  ---

  ## 4. Migración a PostgreSQL (cuando estés listo)

  > El módulo gerencial es el piloto. Cuando funcione bien, se migran todos los demás.

  ### 4.1 Orden recomendado de migración

  | Prioridad | Schema | Variable de entorno |
  |-----------|--------|---------------------|
  | 1 | Gerencial (piloto) | `GERENCIAL_DATABASE_URL` |
  | 2 | Agents (sesiones, memoria) | `AGENTS_DATABASE_URL` |
  | 3 | OC (compras) | `OC_DATABASE_URL` |
  | 4 | Intranet (usuarios, roles) | `DATABASE_URL` |

  ### 4.2 Pasos por schema

  1. **Agregar PostgreSQL al docker-compose.yml:**
     ```yaml
     postgres:
       image: postgres:16-alpine
       environment:
         POSTGRES_USER: zymo
         POSTGRES_PASSWORD: <contraseña-segura>
         POSTGRES_DB: zymo_gerencial
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: always
     ```

  2. **Cambiar la variable de entorno en .env:**
     ```env
     GERENCIAL_DATABASE_URL=postgresql+asyncpg://zymo:<contraseña>@postgres:5432/zymo_gerencial
     ```

  3. **Reiniciar el backend:**
     ```bash
     docker compose restart backend
     ```
     Las tablas se crean automáticamente en el startup del servidor.

  4. **Verificar:**
     ```bash
     curl http://localhost:8001/api/gerencial/kpis \
       -H "Authorization: Bearer <token>"
     ```

  > Nota: si ya hay datos en SQLite y quieres conservarlos, necesitas un script de migración manual.
  > Para empezar desde cero (recomendado en fase piloto), solo cambiar la variable y reiniciar.

  ---

  ## 5. Análisis de consumo de tokens — Gemini API

  ### 5.1 ¿Cuánto consume el sistema?

  | Componente | Tokens/día (estimado) | Observaciones |
  |------------|----------------------|---------------|
  | **ZYMO Worker — rondas supervisoras** | 50,000–80,000 | 12 rondas × ~5,000 tokens c/u |
  | **ZYMO Worker — reporte diario** | 3,000–5,000 | 1 vez al día (8am) |
  | **ZYMO Worker — reporte semanal** | 5,000–8,000 | 1 vez/semana (lunes 7am) |
  | **Chat del gerente (ZYMO)** | 5,000–15,000 | ~15 turnos/día × 500 tokens |
  | **Chat Sonia (Agente Admin)** | 10,000–30,000 | ~30 turnos/día × 600 tokens |
  | **Descripción gerencial (background)** | 2,000–5,000 | Por cada tarea registrada |
  | **Memoria inyectada** | +200–500/request | Overhead pequeño (~15–25 tokens extra/request) |
  | **TOTAL ESTIMADO** | **75,000–140,000/día** | Promedio operación normal |

  ### 5.2 Comparado con el límite gratuito

  | Nivel | Tokens/día disponibles |
  |-------|----------------------|
  | Key 1 (ZYMO gerencial) | 1,000,000 |
  | Key 2 (Agente Admin) | 1,000,000 |
  | **Total disponible** | **2,000,000/día** |
  | **Uso estimado** | **~140,000/día** |
  | **Margen disponible** | **~93% sin usar** |

  > El sistema opera bien dentro del tier gratuito durante la fase de pruebas y en operación normal.

  ### 5.3 ¿Cuándo se necesita pagar?

  El plan gratuito de Gemini Flash empieza a necesitar upgrade cuando:
  - Más de 10 usuarios activos usando chat simultáneamente
  - El worker genera reportes muy largos (>10,000 tokens por reporte)
  - Se agregan más agentes automáticos

  **Costo si se pasa al tier de pago (Gemini 2.0 Flash):**
  - Input: $0.075 USD por 1M tokens
  - Output: $0.30 USD por 1M tokens
  - Estimado mensual en operación normal: **$3–8 USD/mes**
  - Con uso intensivo (50+ usuarios activos): **$15–30 USD/mes**

  ### 5.4 El overhead real de la memoria persistente

  Cada request de chat con memoria inyectada agrega ~150–300 tokens al input.
  Con 50 requests/día totales: 50 × 250 = 12,500 tokens/día extra.
  Costo adicional en tier de pago: $0.001/día ≈ **$0.03/mes**.
  Es completamente despreciable.

  **Conclusión:** La memoria persistente no tiene impacto económico relevante.
  El componente a monitorear es el **worker ZYMO** que corre 24/7.

  ---

  ## 6. Comandos útiles en el servidor

  ```bash
  # Ver logs en tiempo real
  docker compose logs -f backend
  docker compose logs -f zymo-worker

  # Reiniciar un servicio específico
  docker compose restart backend
  docker compose restart zymo-worker

  # Ver consumo de recursos
  docker stats

  # Acceder a la BD de agents (para debugging)
  sqlite3 /var/lib/docker/volumes/zymo_backend_data/_data/agents.db

  # Ver logs de sesiones de los agentes
  ls /var/lib/docker/volumes/zymo_backend_data/_data/agent_logs/
  ```

  ---

  *Actualizado: 2026-04-21 | Próxima actualización cuando se implemente PostgreSQL o Perplexity API*
  ```

- [ ] **Step 3: Commit del .gitignore actualizado**

  ```bash
  git add .gitignore
  git commit -m "chore: agregar SERVIDOR_CONFIGURACION.md a gitignore"
  ```

  > El archivo `SERVIDOR_CONFIGURACION.md` es solo para uso local — no se sube a git.

---

## Self-review

**Spec coverage check:**
- ✅ Backend gerencial activado (Task 1)
- ✅ Documentación migración PostgreSQL (Task 2)
- ✅ Endpoint /documentos/estado (Task 3)
- ✅ Memoria persistente — servicio + inyección (Tasks 4-5)
- ✅ GerencialPage + ruta + tabs por rol + recharts (Task 6)
- ✅ Tab 1 Panel Gerente + badge no leídos + órdenes (Task 7)
- ✅ Tab 2 Directora Planeación + 4 gráficas (Task 8)
- ✅ Tab 3 Desarrollo e Innovación + formulario + historial (Task 9)
- ✅ Tab activo por rol (Task 6 — GerencialPage.tsx)
- ✅ PWA manifest + sw + meta tags (Task 10)
- ✅ Touch events drag (Task 11)
- ✅ Markdown servidor + análisis tokens (Task 12)

**Nombres correctos verificados:**
- `DesarrolloInnovacionTab` ✅ (no `AndresTab`)
- `DirectoraPlaneacionTab` ✅ (no `AndreaTab`)
- `GerencialPage` / `GerencialRoute` ✅

**Tipos consistentes entre tasks:**
- `TareaRead` definida en Task 8 y Task 9 — misma estructura ✅
- `OrdenRead` definida en Task 7 — consistente con el router backend ✅
- `authHeaders()` definida localmente en cada componente (patrón existente en el codebase) ✅
