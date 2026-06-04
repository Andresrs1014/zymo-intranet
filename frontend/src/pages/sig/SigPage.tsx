import { useState } from "react"
import { Routes, Route } from "react-router-dom"
import { SigShell } from "@/components/sig/SigShell"
import { SigAreaList } from "@/components/sig/SigAreaList"
import { SigProcedimientoDetail } from "@/components/sig/SigProcedimientoDetail"
import { SigCommitDetail } from "@/components/sig/SigCommitDetail"
import { SigReviewQueue } from "@/components/sig/SigReviewQueue"
import { useAuthStore } from "@/store/authStore"

export function SigPage() {
  const user = useAuthStore((s) => s.user)
  const isGerente = user?.role === "admin" || user?.role === "gerente"
  const [selectedProcId, setSelectedProcId] = useState<number | null>(null)

  return (
    <SigShell isGerente={isGerente}>
      <Routes>
        <Route index element={
          <SigAreaList onSelectProcedimiento={setSelectedProcId} />
        } />
        <Route path="procedimientos/:id" element={
          <SigProcedimientoDetail />
        } />
        <Route path="commits/:id" element={
          <SigCommitDetail />
        } />
        {isGerente && (
          <Route path="revision" element={<SigReviewQueue />} />
        )}
      </Routes>
    </SigShell>
  )
}
