import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// Tras un despliegue, una pestaña abierta desde antes pide un archivo con el nombre viejo (ya no existe): se recarga una vez para tomar el nuevo.
window.addEventListener("vite:preloadError", () => {
  try {
    if (sessionStorage.getItem("recarga-por-despliegue")) return
    sessionStorage.setItem("recarga-por-despliegue", "1")
  } catch { /* sin sessionStorage: se recarga igual una vez */ }
  window.location.reload()
})
window.addEventListener("load", () => setTimeout(() => { try { sessionStorage.removeItem("recarga-por-despliegue") } catch { /* nada */ } }, 10_000))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
