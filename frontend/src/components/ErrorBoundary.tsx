import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Error capturado:", error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex h-screen bg-muted items-center justify-center">
          <div className="bg-card rounded-xl border border-red-100 shadow-sm p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Ocurrió un error inesperado
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              {this.state.error?.message ?? "Error desconocido"}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Si el problema persiste, contacta al administrador.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.handleReset()
                  window.history.back()
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Volver atrás
              </button>
              <button
                onClick={() => {
                  this.handleReset()
                  window.location.href = "/"
                }}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
