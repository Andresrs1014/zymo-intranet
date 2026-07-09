export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[.06] ${className}`} />
}

export function ListRowSkeleton() {
  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} style={{ padding: "12px 14px" }}>
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  )
}

export function WorkCardSkeleton() {
  return (
    <div className="flex w-full items-start gap-3 rounded-xl border border-white/8 bg-white/[.03] px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-2 h-4 w-2/3" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}
