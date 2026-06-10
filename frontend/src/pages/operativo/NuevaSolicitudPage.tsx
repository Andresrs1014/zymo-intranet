import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { PageLayout } from "@/components/layout/PageLayout"
import { Combobox } from "@/components/ui/Combobox"
import { useAuthStore } from "@/store/authStore"
import { useListasFormulario, useCrearSolicitudInterna, usePaquetes, useSubirFotoSolicitud } from "@/hooks/useOC"
import { useTiposMantenimiento, useCrearMantenimiento } from "@/hooks/useMantenimiento"
import type { SolicitudInternaCreate } from "@/hooks/useOC"
import type { CrearMantenimientoPayload } from "@/types/mantenimiento"
import { useDraft, useAutosaveDraft, useDeleteDraft } from "@/hooks/useDraft"
import { useSedesParaSolicitudesOc } from "@/hooks/useSedes"

const PRIORIDAD_SLA: Record<string, string> = {
  Alta:  "Alta — primera respuesta en 4 horas",
  Media: "Media — primera respuesta en 24 horas",
  Baja:  "Baja — primera respuesta en 48 horas",
}

type TipoSolicitud = "compra" | "mantenimiento"

const FORM_COMPRA_VACIO: SolicitudInternaCreate = {
  tipo_solicitud: "compra",
  nivel_prioridad: "",
  categoria: "",
  grupo_articulos: "",
  descripcion: "",
  cantidad: 1,
  cliente: "",
  condicion: "",
  plataforma: "",
  observaciones_solicitante: "",
}

interface FormMant {
  titulo: string
  tipo_mantenimiento: string
  clasificacion: "correctivo" | "preventivo"
  modalidad: "interno" | "externo"
  fecha_proxima: string
  descripcion: string
}

const FORM_MANT_VACIO: FormMant = {
  titulo: "",
  tipo_mantenimiento: "",
  clasificacion: "correctivo",
  modalidad: "interno",
  fecha_proxima: "",
  descripcion: "",
}

export function NuevaSolicitudPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paqueteId = searchParams.get("paquete")
  const origenId  = searchParams.get("origen")
  const tipoParam = searchParams.get("tipo") as TipoSolicitud | null

  const user = useAuthStore((s) => s.user)
  const { data: listas, isLoading: listasLoading, isError: listasError } = useListasFormulario()
  const {
    data: sedesOc = [],
    isLoading: sedesLoading,
    isError: sedesError,
  } = useSedesParaSolicitudesOc()
  const { data: paquetes } = usePaquetes()
  const { data: tiposMantenimiento = [] } = useTiposMantenimiento()
  const crear = useCrearSolicitudInterna()
  const crearMant = useCrearMantenimiento()
  const subirFoto = useSubirFotoSolicitud()

  const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud>(
    tipoParam === "mantenimiento" ? "mantenimiento" : "compra"
  )
  const [form, setForm] = useState<SolicitudInternaCreate>(() => {
    if (origenId) return { ...FORM_COMPRA_VACIO, origen_solicitud_id: origenId }
    return FORM_COMPRA_VACIO
  })
  const [formMant, setFormMant] = useState<FormMant>(FORM_MANT_VACIO)
  const [paqueteNombre, setPaqueteNombre] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [formDirty, setFormDirty] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialDraftChecked = useRef(false)
  // Guard síncrono: evita doble envío por clics rápidos antes de que isPending actualice
  const submitInFlight = useRef(false)
  const [dragOver, setDragOver] = useState(false)
  const [archivos, setArchivos] = useState<File[]>([])
  const [subiendoArchivos, setSubiendoArchivos] = useState(false)

  const { data: borrador } = useDraft("solicitud_nueva")
  const deleteDraft = useDeleteDraft()

  // Autosave del formulario (1.5s debounced) — solo si el usuario tocó el formulario y no viene de paquete
  useAutosaveDraft("solicitud_nueva", undefined, (draftRestored || formDirty) && !paqueteId ? (form as unknown as Record<string, unknown>) : null)

  const opcionesPrioridad = useMemo(
    () =>
      (listas?.prioridades ?? []).map((p) => ({
        value: p,
        label: PRIORIDAD_SLA[p] ?? p,
        sublabel: p,
      })),
    [listas?.prioridades]
  )

  const opcionesCategoria = useMemo(
    () => (listas?.categorias ?? []).map((c) => ({ value: c, label: c })),
    [listas?.categorias]
  )

  const opcionesGrupoArticulos = useMemo(
    () => (listas?.grupos_articulos ?? []).map((g) => ({ value: g, label: g })),
    [listas?.grupos_articulos]
  )

  const opcionesCliente = useMemo(
    () => (listas?.clientes ?? []).map((c) => ({ value: c, label: c })),
    [listas?.clientes]
  )

  const opcionesCondicion = useMemo(
    () => (listas?.condiciones ?? []).map((c) => ({ value: c, label: c })),
    [listas?.condiciones]
  )

  const opcionesPlaca = useMemo(
    () => (listas?.placas ?? []).map((p) => ({ value: p, label: p })),
    [listas?.placas]
  )

  const opcionesPlataforma = useMemo(
    () => sedesOc.map((s) => ({ value: s.name, label: s.name })),
    [sedesOc]
  )

  const opcionesTipoMantenimiento = useMemo(
    () => tiposMantenimiento.filter((t) => t.activo).map((t) => ({ value: t.nombre, label: t.nombre })),
    [tiposMantenimiento]
  )

  // Cambiar tipo de solicitud limpia el formulario
  function cambiarTipo(tipo: TipoSolicitud) {
    setTipoSolicitud(tipo)
    if (tipo === "compra") {
      setForm(origenId ? { ...FORM_COMPRA_VACIO, origen_solicitud_id: origenId } : { ...FORM_COMPRA_VACIO })
    } else {
      setFormMant({ ...FORM_MANT_VACIO })
    }
    setPaqueteNombre(null)
    setError(null)
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- prellenar formulario desde ?paquete= */
    if (!paqueteId || !paquetes) return
    const paquete = paquetes.find((p) => p.id === paqueteId)
    if (!paquete || !paquete.items.length) return

    const item = paquete.items[0]
    setTipoSolicitud("compra")
    setForm({
      tipo_solicitud: "compra",
      nivel_prioridad: item.nivel_prioridad ?? "",
      categoria: item.categoria ?? "",
      grupo_articulos: item.grupo_articulos ?? "",
      descripcion: item.descripcion ?? "",
      cantidad: item.cantidad ?? 1,
      cliente: item.cliente ?? "",
      condicion: item.condicion ?? "",
      plataforma: item.plataforma ?? "",
      observaciones_solicitante: item.observaciones_solicitante ?? "",
    })
    setPaqueteNombre(paquete.nombre)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [paqueteId, paquetes])

  useEffect(() => {
    // Solo verificar el borrador una vez al montar la página.
    // Si se revisa en cada cambio de `borrador`, el autosave posterior crea un
    // borrador nuevo → invalida la query → vuelve a mostrar el modal mientras
    // el usuario ya está llenando el formulario.
    if (initialDraftChecked.current) return
    if (borrador === undefined) return // todavía cargando
    initialDraftChecked.current = true
    if (borrador && !paqueteId) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- modal de borrador al cargar */
      setShowDraftModal(true)
    }
  }, [borrador, paqueteId])

  function handleChange<K extends keyof SolicitudInternaCreate>(
    field: K,
    value: SolicitudInternaCreate[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setFormDirty(true)
  }

  const MAX_FILES = 5
  const MAX_FILE_BYTES = 20 * 1024 * 1024

  function _filtrarNuevosArchivos(nuevos: File[], actuales: File[]): File[] {
    const validos = nuevos.filter((f) => {
      if (f.size > MAX_FILE_BYTES) { setError(`"${f.name}" supera el límite de 20 MB.`); return false }
      return true
    })
    const disponibles = MAX_FILES - actuales.length
    if (disponibles <= 0) return []
    return validos.slice(0, disponibles)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const nuevos = Array.from(e.target.files)
      setArchivos((prev) => [...prev, ..._filtrarNuevosArchivos(nuevos, prev)])
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) {
      const nuevos = Array.from(e.dataTransfer.files)
      setArchivos((prev) => [...prev, ..._filtrarNuevosArchivos(nuevos, prev)])
    }
  }

  function removeFile(index: number) {
    setArchivos((prev) => prev.filter((_, i) => i !== index))
  }

  function validarFormulario(): string | null {
    if (tipoSolicitud === "compra") {
      if (sedesOc.length === 0) {
        return "No hay sedes habilitadas para compras (OC). Un administrador debe marcar al menos una sede con «OC compras» en Áreas y sedes."
      }
      if (!form.nivel_prioridad) return "Selecciona la prioridad."
      if (!form.descripcion.trim()) return "Ingresa la descripción."
      if (!form.plataforma?.trim()) return "Selecciona la plataforma."
      if (form.cantidad < 1) return "La cantidad debe ser al menos 1."
      if (!form.categoria) return "Selecciona la categoría."
      if (!form.grupo_articulos) return "Selecciona el grupo de artículos."
    }

    if (tipoSolicitud === "mantenimiento") {
      if (!formMant.titulo.trim()) return "Ingresa un titulo para el mantenimiento."
      if (!formMant.tipo_mantenimiento) return "Selecciona el tipo de mantenimiento."
      if (formMant.clasificacion === "preventivo" && !formMant.fecha_proxima) {
        return "Indica la fecha del próximo mantenimiento."
      }
      if (!formMant.descripcion.trim()) return "Ingresa la descripción del trabajo a realizar."
    }

    return null
  }

  function restaurarBorrador() {
    if (!borrador?.payload) return
    const payload = borrador.payload as unknown as SolicitudInternaCreate & { tipo_solicitud?: string }
    const tipo = (payload.tipo_solicitud ?? "compra") as TipoSolicitud
    setTipoSolicitud(tipo)
    if (tipo === "compra") setForm({ ...FORM_COMPRA_VACIO, ...payload })
    setDraftRestored(true)
    setShowDraftModal(false)
  }

  function descartarBorrador() {
    deleteDraft.mutate({ tipo: "solicitud_nueva" })
    setShowDraftModal(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (submitInFlight.current || crear.isPending || crearMant.isPending) return
    submitInFlight.current = true

    const validationError = validarFormulario()
    if (validationError) {
      setError(validationError)
      submitInFlight.current = false
      return
    }

    try {
      if (tipoSolicitud === "mantenimiento") {
        // Escribe en mnt_solicitudes con sus propios estados
        const mantPayload: CrearMantenimientoPayload = {
          titulo: formMant.titulo.trim(),
          descripcion: formMant.descripcion.trim(),
          tipo_mantenimiento: formMant.tipo_mantenimiento,
          clasificacion: formMant.clasificacion,
          modalidad: formMant.modalidad,
          fecha_proxima_mantenimiento: formMant.clasificacion === "preventivo" ? (formMant.fecha_proxima || null) : null,
        }
        await crearMant.mutateAsync(mantPayload)
        navigate("/mantenimiento")
      } else {
        // Compra — flujo OC normal
        const payload: SolicitudInternaCreate = {
          ...form,
          tipo_solicitud: "compra",
          plataforma: form.plataforma!,
          cliente: form.cliente || undefined,
          condicion: form.condicion || undefined,
          observaciones_solicitante: form.observaciones_solicitante || undefined,
          categoria: form.categoria || undefined,
          grupo_articulos: form.grupo_articulos || undefined,
        }

        const solicitudCreada = await crear.mutateAsync(payload)

        if (archivos.length > 0) {
          setSubiendoArchivos(true)
          const promesas = archivos.map((archivo) =>
            subirFoto.mutateAsync({ solicitudId: solicitudCreada.id, file: archivo })
          )
          await Promise.all(promesas)
          setSubiendoArchivos(false)
        }

        navigate("/operativo/mis-solicitudes")
        deleteDraft.mutate({ tipo: "solicitud_nueva" })
      }
    } catch {
      submitInFlight.current = false
      setSubiendoArchivos(false)
      setError("Error al procesar la solicitud. Intenta de nuevo.")
    }
  }

  return (
    <>
      {showDraftModal && borrador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-foreground mb-2">Borrador guardado</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Tienes un borrador guardado del{" "}
              <span className="font-medium text-foreground">
                {new Date(borrador.updated_at).toLocaleDateString("es-CO", {
                  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </p>
            <p className="text-sm text-muted-foreground mb-5">¿Deseas continuar donde lo dejaste?</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={descartarBorrador}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted transition-colors"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={restaurarBorrador}
                className="px-4 py-2 rounded-lg text-sm bg-brand-blue text-white hover:bg-primary/90 transition-colors font-medium"
              >
                Continuar borrador
              </button>
            </div>
          </div>
        </div>
      )}
      <PageLayout title="Operativo">
        <div className="max-w-3xl mx-auto">
          {/* Volver */}
          <button
            onClick={() => navigate("/operativo/mis-solicitudes")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Volver
          </button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Nueva Solicitud</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Los campos marcados con * son obligatorios
            </p>
          </div>

          {/* Selector de tipo de solicitud */}
          <div className="mb-6 flex gap-3">
            <button
              type="button"
              onClick={() => cambiarTipo("compra")}
              className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                tipoSolicitud === "compra"
                  ? "border-primary bg-brand-blue text-white shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Solicitud de Compra
            </button>
            <button
              type="button"
              onClick={() => cambiarTipo("mantenimiento")}
              className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                tipoSolicitud === "mantenimiento"
                  ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-amber-400/40 hover:bg-muted"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
              Solicitud de Mantenimiento
            </button>
          </div>

          {/* Banner: compra vinculada a mantenimiento */}
          {origenId && tipoSolicitud === "compra" && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-amber-500 text-base shrink-0">🔧</span>
              <p className="text-sm text-amber-800">
                Esta compra quedará vinculada a la solicitud de mantenimiento.
              </p>
            </div>
          )}

          {/* Aviso de mantenimiento */}
          {tipoSolicitud === "mantenimiento" && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Solicitud de mantenimiento</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Si este mantenimiento requiere compra de repuestos o materiales,
                  debes crear una <strong>solicitud de compra separada</strong> después de enviar esta.
                </p>
              </div>
            </div>
          )}

          {/* Banner plantilla cargada */}
          {paqueteNombre && (
            <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2.5">
              <span className="text-indigo-500 text-base">📦</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-700">Plantilla cargada</p>
                <p className="text-xs text-indigo-600 truncate">{paqueteNombre}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...FORM_COMPRA_VACIO })
                  setPaqueteNombre(null)
                }}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors shrink-0"
              >
                Limpiar
              </button>
            </div>
          )}

          {/* Skeleton mientras cargan las listas */}
          {(listasLoading || sedesLoading) && (
            <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
              <svg
                className="animate-spin h-5 w-5 mr-2 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando formulario...
            </div>
          )}

          {/* Error al cargar listas */}
          {!listasLoading && !sedesLoading && (listasError || sedesError) && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-sm text-red-600 font-medium">
                No se pudieron cargar las opciones del formulario.
              </p>
              <p className="text-xs text-muted-foreground">
                Verifica tu conexión y recarga la página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 text-sm bg-brand-blue text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Recargar
              </button>
            </div>
          )}

          {!listasLoading && !sedesLoading && !listasError && !sedesError && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sección Solicitante */}
              <section className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Solicitante
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
                    <p className="text-sm font-medium text-foreground">{user?.full_name ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">Área</p>
                    <p className="text-sm font-medium text-foreground">{user?.area ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted border border-border px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">Fecha</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date().toLocaleDateString("es-CO")}
                    </p>
                  </div>
                </div>
              </section>

              {/* ── FORMULARIO: MANTENIMIENTO ────────────────────────────── */}
              {tipoSolicitud === "mantenimiento" && (
                <section className="bg-card rounded-xl border border-amber-200 p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                    Datos del mantenimiento
                  </h2>

                  {/* Titulo */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Titulo *
                    </label>
                    <input
                      type="text"
                      value={formMant.titulo}
                      onChange={(e) => setFormMant((p) => ({ ...p, titulo: e.target.value }))}
                      placeholder="Ej. Falla en montacargas VH-001, mantenimiento preventivo compresor..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* Tipo de mantenimiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Tipo de mantenimiento *
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesTipoMantenimiento}
                        value={formMant.tipo_mantenimiento || null}
                        onChange={(v) => setFormMant((p) => ({ ...p, tipo_mantenimiento: v != null ? String(v) : "" }))}
                        placeholder="Seleccionar tipo..."
                      />
                    </div>

                    {/* Placa del equipo */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Placa / Equipo
                      </label>
                      {listas?.placas && listas.placas.length > 0 ? (
                        <Combobox
                          className="w-full"
                          options={opcionesPlaca}
                          value={null}
                          onChange={() => {}}
                          placeholder="Buscar placa o equipo..."
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="Ej. VH-001 o número de ficha técnica"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                    </div>
                  </div>

                  {/* Clasificación — Correctivo / Preventivo */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Clasificacion *
                    </label>
                    <SegmentedControl
                      value={formMant.clasificacion}
                      options={[
                        { value: "correctivo", label: "Correctivo", accent: "red" },
                        { value: "preventivo", label: "Preventivo", accent: "green" },
                      ]}
                      onChange={(v) => setFormMant((p) => ({
                        ...p,
                        clasificacion: v as "correctivo" | "preventivo",
                        fecha_proxima: v === "correctivo" ? "" : p.fecha_proxima,
                      }))}
                    />
                  </div>

                  {/* Modalidad — Interno / Externo */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Modalidad *
                    </label>
                    <SegmentedControl
                      value={formMant.modalidad}
                      options={[
                        { value: "interno", label: "Interno" },
                        { value: "externo", label: "Externo" },
                      ]}
                      onChange={(v) => setFormMant((p) => ({ ...p, modalidad: v as "interno" | "externo" }))}
                    />
                  </div>

                  {/* Fecha próximo mantenimiento — solo si preventivo */}
                  <div className={`overflow-hidden transition-all duration-200 ${
                    formMant.clasificacion === "preventivo" ? "max-h-24 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                  }`}>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Fecha proxima de mantenimiento *
                    </label>
                    <input
                      type="date"
                      value={formMant.fecha_proxima}
                      onChange={(e) => setFormMant((p) => ({ ...p, fecha_proxima: e.target.value }))}
                      className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Descripcion del trabajo a realizar *
                    </label>
                    <textarea
                      rows={4}
                      value={formMant.descripcion}
                      onChange={(e) => setFormMant((p) => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Describe el mantenimiento requerido, sintomas observados o trabajos a realizar..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>
                </section>
              )}

              {/* ── FORMULARIO: COMPRA ──────────────────────────────────── */}
              {tipoSolicitud === "compra" && (
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Detalle del pedido
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Prioridad */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Prioridad *
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesPrioridad}
                        value={form.nivel_prioridad || null}
                        onChange={(v) => handleChange("nivel_prioridad", (v as string) ?? "")}
                        placeholder="Buscar prioridad…"
                      />
                    </div>

                    {/* Categoría */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Categoría / Estatus *
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesCategoria}
                        value={form.categoria || null}
                        onChange={(v) => handleChange("categoria", (v as string) ?? "")}
                        placeholder="Buscar categoría…"
                      />
                    </div>

                    {/* Grupo de artículos */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Grupo de artículos *
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesGrupoArticulos}
                        value={form.grupo_articulos || null}
                        onChange={(v) => handleChange("grupo_articulos", (v as string) ?? "")}
                        placeholder="Buscar grupo…"
                      />
                    </div>

                    {/* Cliente */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Cliente
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesCliente}
                        value={form.cliente || null}
                        onChange={(v) => handleChange("cliente", (v as string) ?? "")}
                        placeholder="Buscar cliente (opcional)…"
                      />
                    </div>

                    {/* Condición */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Condición
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesCondicion}
                        value={form.condicion || null}
                        onChange={(v) => handleChange("condicion", (v as string) ?? "")}
                        placeholder="Buscar condición…"
                      />
                    </div>

                    {/* Plataforma */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Plataforma *
                      </label>
                      <Combobox
                        className="w-full"
                        options={opcionesPlataforma}
                        value={form.plataforma || null}
                        onChange={(v) => handleChange("plataforma", (v as string) ?? "")}
                        placeholder="Buscar plataforma…"
                        disabled={opcionesPlataforma.length === 0}
                      />
                    </div>
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Detalle / descripción material *
                    </label>
                    <textarea
                      rows={4}
                      value={form.descripcion}
                      onChange={(e) => handleChange("descripcion", e.target.value)}
                      placeholder="Describe el material o servicio que necesitas..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>

                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.cantidad}
                      onChange={(e) => handleChange("cantidad", parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* Observaciones */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Observaciones del solicitante
                    </label>
                    <textarea
                      rows={3}
                      value={form.observaciones_solicitante ?? ""}
                      onChange={(e) => handleChange("observaciones_solicitante", e.target.value)}
                      placeholder="Información adicional para el equipo de compras..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>
                </section>
              )}

              {/* Sección de Evidencias */}
              <section className="bg-card rounded-xl border border-border p-6 space-y-4">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Fotos / Evidencias
                </h2>
                <p className="text-xs text-muted-foreground">
                  Sube fotos o archivos que ayuden al equipo de compras a identificar el producto (JPG, PNG, PDF). Opcional.
                </p>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted"
                  }`}
                >
                  <svg className="w-8 h-8 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-medium text-foreground">Arrastra o haz clic para subir</p>
                  <p className="text-xs text-muted-foreground">Hasta 5 archivos — JPG, PNG, PDF, Excel, Word, MSG — máx 20 MB c/u</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.docx,.msg"
                  className="hidden"
                  onChange={handleFileSelect}
                  onClick={(e) => { (e.target as HTMLInputElement).value = "" }}
                />

                {archivos.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {archivos.map((archivo, index) => {
                      const isImg = archivo.type.startsWith("image/")
                      return (
                        <div key={`${archivo.name}-${index}`} className="group relative flex items-center gap-3 bg-muted hover:bg-muted/80 p-2.5 rounded-lg border border-border shadow-sm transition-colors pr-10">
                          <div className={`flex items-center justify-center w-10 h-10 rounded shrink-0 ${isImg ? "bg-blue-100 text-primary" : "bg-muted-foreground/10 text-muted-foreground"}`}>
                            {isImg ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{isImg ? "Imagen" : "Documento"}</span>
                            <span className="truncate text-sm text-foreground font-medium">{archivo.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Eliminar archivo"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex items-center justify-end gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => navigate("/operativo/mis-solicitudes")}
                  disabled={crear.isPending || subiendoArchivos}
                  className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crear.isPending || subiendoArchivos}
                  className={`rounded-lg px-6 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-all ${
                    tipoSolicitud === "mantenimiento"
                      ? "bg-amber-500 hover:brightness-105"
                      : "bg-brand-blue hover:brightness-105"
                  }`}
                >
                  {subiendoArchivos
                    ? "Subiendo evidencias..."
                    : crear.isPending
                    ? "Creando solicitud..."
                    : tipoSolicitud === "mantenimiento"
                    ? "Enviar solicitud de mantenimiento"
                    : "Enviar solicitud"}
                </button>
              </div>
            </form>
          )}
        </div>
      </PageLayout>
    </>
  )
}

// ── SegmentedControl ──────────────────────────────────────────────────────────

interface SegmentOption {
  value: string
  label: string
  accent?: "red" | "green"
}

interface SegmentedControlProps {
  value: string
  options: SegmentOption[]
  onChange: (value: string) => void
}

function SegmentedControl({ value, options, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex border border-border rounded-md overflow-hidden divide-x divide-border">
      {options.map((opt) => {
        const isSelected = value === opt.value
        const accentBorder =
          isSelected && opt.accent === "red"
            ? "border-l-2 border-l-red-500"
            : isSelected && opt.accent === "green"
            ? "border-l-2 border-l-emerald-500"
            : ""
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "px-5 py-2 text-sm transition-colors",
              accentBorder,
              isSelected
                ? "bg-muted text-foreground font-semibold"
                : "bg-card text-muted-foreground hover:bg-muted/50",
            ].join(" ")}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
