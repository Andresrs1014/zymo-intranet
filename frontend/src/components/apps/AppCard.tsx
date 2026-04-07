import { useAuthStore } from "@/store/authStore"
import type { AppDefinition } from "@/lib/roles"

interface AppCardProps {
  app: AppDefinition
}

export function AppCard({ app }: AppCardProps) {
  const token = useAuthStore((s) => s.token)

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    const url = token ? `${app.url}?token=${token}` : app.url
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <a
      href={app.url}
      onClick={handleOpen}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-blue/20 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl" role="img" aria-label={app.name}>
          {app.icon}
        </span>
        <svg
          className="h-4 w-4 text-gray-300 transition-colors group-hover:text-brand-blue"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 group-hover:text-brand-blue transition-colors">
          {app.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500 leading-snug">
          {app.description}
        </p>
      </div>

      <div className="mt-auto pt-1">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue/70 group-hover:text-brand-blue transition-colors">
          Abrir app
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </a>
  )
}
