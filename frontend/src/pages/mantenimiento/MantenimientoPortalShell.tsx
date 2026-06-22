import { Outlet } from "react-router-dom"
import { MantenimientoPortalProvider } from "@/context/MantenimientoPortalContext"

export default function MantenimientoPortalShell() {
  return (
    <MantenimientoPortalProvider>
      <Outlet />
    </MantenimientoPortalProvider>
  )
}
