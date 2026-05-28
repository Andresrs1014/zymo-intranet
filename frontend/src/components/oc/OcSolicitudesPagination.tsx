import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { visibleOcSolicitudesPages } from "@/lib/ocSolicitudesPagination"

interface OcSolicitudesPaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function OcSolicitudesPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: OcSolicitudesPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  if (totalItems <= pageSize) {
    return null
  }

  const visible = visibleOcSolicitudesPages(currentPage, totalPages)
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages)
    if (next !== currentPage) onPageChange(next)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
      <p className="text-sm text-muted-foreground order-2 sm:order-1">
        Mostrando{" "}
        <span className="font-medium text-foreground">
          {start}–{end}
        </span>{" "}
        de <span className="font-medium text-foreground">{totalItems}</span>
      </p>
      <Pagination className="justify-end sm:justify-center order-1 sm:order-2 mx-0 w-full sm:w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={currentPage <= 1 ? "pointer-events-none opacity-40" : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(currentPage - 1)
              }}
            />
          </PaginationItem>
          {visible.map((item, idx) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  href="#"
                  size="icon"
                  isActive={item === currentPage}
                  onClick={(e) => {
                    e.preventDefault()
                    go(item)
                  }}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              className={currentPage >= totalPages ? "pointer-events-none opacity-40" : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(currentPage + 1)
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
