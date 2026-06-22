import axios from "axios"
import { api } from "@/lib/api"

/** Cliente HTTP para portal móvil — sin redirect a login en 401. */
export const portalHttp = axios.create({
  baseURL: api.defaults.baseURL,
})
