import "@/styles/helix.css"

interface HelixProviderProps {
  children: React.ReactNode
}

export function HelixProvider({ children }: HelixProviderProps) {
  return (
    <div data-module="helix" className="font-helix h-full">
      {children}
    </div>
  )
}
