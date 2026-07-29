import { useSessionStore } from "@/store/sessionStore"
import { LoginPage } from "@/pages/LoginPage"
import { AppShell } from "@/components/layout/AppShell"

export default function App() {
  const token = useSessionStore((s) => s.token)
  return token ? <AppShell /> : <LoginPage />
}
