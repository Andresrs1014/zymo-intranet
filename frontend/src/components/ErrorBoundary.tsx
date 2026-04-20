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
        <div className="flex h-screen bg-gray-50 items-center justify-center">
          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Ocurrió un error inesperado
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {this.state.error?.message ?? "Error desconocido"}
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Si el problema persiste, contacta al administrador.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.handleReset()
                  window.history.back()
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
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
