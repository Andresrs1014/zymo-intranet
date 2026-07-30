import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  Plus, Trash2, Save, ChevronDown, ChevronRight,
  Package, Bell, ArrowRight, Mail, MessageCircle, UserX, Send,
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PaqueteItem { id?: number; titulo: string; horas: number | null; orden: number }
interface Paquete { id: number; nombre: string; descripcion: string; activo: boolean; items: PaqueteItem[] }

interface Cargo { id: number; nombre: string }
interface Destinatario { persona_id: number; nombre: string; email: string; cargo_nombre: string }

type Tab = "notificaciones" | "paquetes"

// ── Componente ────────────────────────────────────────────────────────────────

export function TyCConfigPage() {
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false
  const [tab, setTab] = useState<Tab>("notificaciones")

  return (
    <PageLayout title="Configuración T&C" mainClassName="flex-1 overflow-y-auto">
      <div className="border-b border-border px-8 pt-6 pb-0">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
            Talento y Cultura
          </p>
          <h1 className="text-xl font-bold mb-4">Configuración</h1>
          <div className="flex gap-0 -mb-px">
            {(["notificaciones", "paquetes"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 capitalize transition-colors ${
                  tab === t ? "border-teal-500 text-teal-400" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "notificaciones" ? <Bell className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                {t === "notificaciones" ? "Notificaciones" : "Paquetes de capacitación"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-6">
        <div className="animate-fade-in">
          {tab === "notificaciones" && <NotificacionesTab />}
          {tab === "paquetes" && <PaquetesTab puedeEditar={puedeEditar} />}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </PageLayout>
  )
}

// ── Tab Paquetes ──────────────────────────────────────────────────────────────

function PaquetesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get("/tc/paquetes").then((r) => setPaquetes(r.data))
  }, [])
  useEffect(() => { load() }, [load])

  async function crearPaquete() {
    if (!newNombre.trim()) return
    setSaving(true)
    try {
      const r = await api.post("/tc/paquetes", { nombre: newNombre.trim(), descripcion: "", activo: true })
      setPaquetes((p) => [...p, { ...r.data, items: [] }])
      setNewNombre("")
      setCreating(false)
      setExpanded(r.data.id)
    } finally { setSaving(false) }
  }

  async function eliminar(id: number) {
    await api.delete(`/tc/paquetes/${id}`)
    setPaquetes((p) => p.filter((x) => x.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Define plantillas de capacitaciones que se pre-cargan al crear un evento.
        </p>
        {puedeEditar && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo paquete
          </button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 p-3 rounded-xl border border-teal-500/30 bg-teal-500/5">
          <input
            autoFocus
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearPaquete()}
            placeholder="Nombre del paquete (ej. Inducción nuevos empleados)"
            className="input-base flex-1 text-sm"
          />
          <button onClick={crearPaquete} disabled={saving || !newNombre.trim()}
            className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 text-xs font-semibold disabled:opacity-40">
            {saving ? "..." : "Crear"}
          </button>
          <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {paquetes.map((p) => (
        <PaqueteCard
          key={p.id}
          paquete={p}
          expanded={expanded === p.id}
          onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
          onDelete={() => eliminar(p.id)}
          onUpdated={(updated) => setPaquetes((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
          puedeEditar={puedeEditar}
        />
      ))}

      {paquetes.length === 0 && !creating && (
        <div className="text-center py-12 text-muted-foreground text-xs">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
          Sin paquetes configurados
        </div>
      )}
    </div>
  )
}

// ── Card de un paquete ────────────────────────────────────────────────────────

function PaqueteCard({
  paquete, expanded, onToggle, onDelete, onUpdated, puedeEditar,
}: {
  paquete: Paquete
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdated: (p: Paquete) => void
  puedeEditar: boolean
}) {
  const [items, setItems] = useState<PaqueteItem[]>(paquete.items)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(paquete.items) }, [paquete.items])

  function addItem() {
    setItems((prev) => [...prev, { titulo: "", horas: null, orden: prev.length }])
  }

  function updateItem(i: number, field: keyof PaqueteItem, value: string | number | null) {
    setItems((prev) => prev.map((x, j) => j === i ? { ...x, [field]: value } : x))
  }

  async function saveItems() {
    setSaving(true)
    try {
      const r = await api.put(`/tc/paquetes/${paquete.id}/items`,
        items.filter((x) => x.titulo.trim()).map((x, i) => ({ titulo: x.titulo, horas: x.horas, orden: i }))
      )
      onUpdated(r.data)
    } finally { setSaving(false) }
  }

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? "border-teal-500/20 bg-teal-500/5" : "border-border bg-muted/5"}`}>
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-teal-400" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <div>
            <p className="text-sm font-semibold">{paquete.nombre}</p>
            <p className="text-[10px] text-muted-foreground">
              {paquete.items.length} capacitación{paquete.items.length !== 1 ? "es" : ""}
            </p>
          </div>
        </button>
        {puedeEditar && (
          <button onClick={onDelete} className="opacity-30 hover:opacity-100 transition-opacity text-rose-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[10px] text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
              <input
                value={item.titulo}
                onChange={(e) => updateItem(i, "titulo", e.target.value)}
                placeholder="Título de la capacitación"
                className="input-base text-xs flex-[3]"
                readOnly={!puedeEditar}
              />
              <input
                type="number"
                value={item.horas ?? ""}
                onChange={(e) => updateItem(i, "horas", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Horas"
                className="input-base text-xs w-20"
                readOnly={!puedeEditar}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">h</span>
              {puedeEditar && (
                <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  className="text-rose-400/40 hover:text-rose-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {puedeEditar && (
            <div className="flex items-center gap-3 pt-1">
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar ítem
              </button>
              <button onClick={saveItems} disabled={saving}
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors ml-auto disabled:opacity-40">
                <Save className="w-3.5 h-3.5" />
                {saving ? "Guardando..." : "Guardar items"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab Notificaciones (WA + SMTP) ────────────────────────────────────────────
// El correo y WhatsApp de eventos usan la cuenta corporativa centralizada
// (Configuración de la intranet) — T&C ya no tiene sus propias credenciales editables acá.

function NotificacionesTab() {
  const navigate = useNavigate()
  const esAdmin = useAuthStore((s) => s.user?.role === "admin")

  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          El correo y el WhatsApp para notificar al líder del área ahora usan la
          <strong className="text-foreground"> cuenta corporativa centralizada</strong> — la misma
          que comparten Tickets y Gestión de Tareas.
        </p>

        {esAdmin ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/admin/configuracion/smtp")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-teal-500/30 transition-all text-sm font-medium"
            >
              <Mail className="w-4 h-4 text-sky-400" /> SMTP corporativo
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/admin/configuracion/whatsapp")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 hover:border-teal-500/30 transition-all text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366]" /> WhatsApp corporativo
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Solo un administrador puede editar esa cuenta compartida — pídele a un admin que
            entre a Configuración de la intranet si algo no está llegando.
          </p>
        )}
      </div>

      {esAdmin ? (
        <RetiroNotificacionPanel />
      ) : (
        <p className="text-xs text-muted-foreground italic pt-6 border-t border-border">
          Por ahora, solo un administrador puede configurar los destinatarios de retiro de funcionario.
        </p>
      )}
    </div>
  )
}

// ── Panel: destinatarios de "Retiro de funcionario" ────────────────────────────
// Se dispara solo cuando alguien pasa a Inactivo desde Rotación. Selección por
// cargo (no por persona individual) — mismo filtro que ya existe en Directorio.

function RetiroNotificacionPanel() {
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [probando, setProbando] = useState(false)
  const [pruebaMsg, setPruebaMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    Promise.all([
      api.get("/tc/cargos"),
      api.get("/tc/config/retiro-notificacion"),
    ]).then(([cargosRes, configRes]) => {
      setCargos(Array.isArray(cargosRes.data) ? cargosRes.data : [])
      setSelected(new Set(configRes.data.cargo_ids ?? []))
      setDestinatarios(configRes.data.destinatarios ?? [])
    }).finally(() => setLoading(false))
  }, [])

  function toggle(cargoId: number) {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cargoId)) next.delete(cargoId); else next.add(cargoId)
      return next
    })
  }

  async function guardar() {
    setSaving(true)
    try {
      const { data } = await api.put("/tc/config/retiro-notificacion", { cargo_ids: [...selected] })
      const configRes = await api.get("/tc/config/retiro-notificacion")
      setDestinatarios(configRes.data.destinatarios ?? [])
      setSelected(new Set(data.cargo_ids ?? []))
      setSaved(true)
      setPruebaMsg(null)
    } finally {
      setSaving(false)
    }
  }

  async function enviarPrueba() {
    setProbando(true)
    setPruebaMsg(null)
    try {
      const { data } = await api.post("/tc/config/retiro-notificacion/prueba")
      setPruebaMsg({ ok: true, texto: `Correo de prueba enviado a ${data.enviados} destinatario${data.enviados !== 1 ? "s" : ""}.` })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPruebaMsg({ ok: false, texto: detail || "No se pudo enviar el correo de prueba." })
    } finally {
      setProbando(false)
    }
  }

  return (
    <div className="space-y-3 pt-6 border-t border-border">
      <div className="flex items-center gap-2">
        <UserX className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold">Destinatarios — Retiro de funcionario</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Cuando alguien se marca Inactivo en Rotación, se avisa automáticamente por correo a
        todas las personas de los cargos que marques aquí.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4">Cargando cargos…</p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
          {cargos.map((c) => (
            <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/10 transition-colors">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="rounded border-input accent-teal-500"
              />
              {c.nombre}
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={saving || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Guardando…" : "Guardar destinatarios"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Guardado.</span>}
      </div>

      {destinatarios.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Recibirán el aviso ({destinatarios.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {destinatarios.map((d) => (
              <span key={d.persona_id} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground">
                {d.nombre} · {d.cargo_nombre}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={enviarPrueba}
              disabled={probando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/10 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" /> {probando ? "Enviando…" : "Enviar correo de prueba"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Manda el correo con datos de ejemplo a los destinatarios ya guardados arriba — guarda primero si acabas de cambiar la selección.
          </p>
          {pruebaMsg && (
            <p className={`text-xs ${pruebaMsg.ok ? "text-emerald-400" : "text-destructive"}`}>{pruebaMsg.texto}</p>
          )}
        </div>
      )}
    </div>
  )
}
