import axios from "axios"
import prisma from "../config/prisma"
import { env } from "../config/env"

interface ZymoEnrichResponse {
  descripcion_gerencial?: string
  impacto?: string
}

interface ZymoSuggestResponse {
  etiqueta_sugerida?: string
  plataforma_sugerida?: string
  tiempo_estimado_minutos?: number
}

/**
 * Fire-and-forget: enriches task with gerencial description and impact via ZYMO agent.
 * Never throws — failures are logged silently.
 */
export function enrichTaskAsync(
  taskId: number,
  titulo: string,
  descripcionTecnica: string | null | undefined,
  etiqueta: string,
  plataforma: string,
): void {
  const payload = { titulo, descripcion_tecnica: descripcionTecnica ?? "", etiqueta, plataforma }

  axios
    .post<ZymoEnrichResponse>(`${env.INTRANET_API_URL}/api/agentes/zymo`, payload, {
      timeout: env.AI_TIMEOUT_MS,
      headers: { "X-Internal-Key": env.INTERNAL_KEY },
    })
    .then(async (res) => {
      const { descripcion_gerencial, impacto } = res.data
      if (!descripcion_gerencial && !impacto) return

      await prisma.task.update({
        where: { id: taskId },
        data: {
          descripcionGerencial: descripcion_gerencial ?? undefined,
          impacto: impacto ?? undefined,
          version: { increment: 1 },
        },
      })
    })
    .catch((err: Error) => {
      console.error(`[AI] enrichTaskAsync failed for task ${taskId}:`, err.message)
    })
}

/**
 * Synchronous suggestion call — returns suggestions or { available: false } on failure.
 */
export async function getSuggestions(titulo: string): Promise<
  | { available: true; etiqueta_sugerida?: string; plataforma_sugerida?: string; tiempo_estimado_minutos?: number }
  | { available: false }
> {
  try {
    const res = await axios.post<ZymoSuggestResponse>(
      `${env.INTRANET_API_URL}/api/agentes/zymo/sugerencias`,
      { titulo },
      {
        timeout: 5000,
        headers: { "X-Internal-Key": env.INTERNAL_KEY },
      },
    )
    return {
      available: true,
      etiqueta_sugerida: res.data.etiqueta_sugerida,
      plataforma_sugerida: res.data.plataforma_sugerida,
      tiempo_estimado_minutos: res.data.tiempo_estimado_minutos,
    }
  } catch {
    return { available: false }
  }
}
