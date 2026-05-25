import { Request } from "express"

export interface PaginationParams {
  skip: number
  take: number
  page: number
  limit: number
}

export function parsePagination(req: Request, defaultLimit = 50): PaginationParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? String(defaultLimit)), 10) || defaultLimit))
  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  }
}

export function setPaginationHeaders(
  res: import("express").Response,
  total: number,
  page: number,
  limit: number,
): void {
  res.setHeader("X-Total-Count", String(total))
  res.setHeader("X-Page", String(page))
  res.setHeader("X-Limit", String(limit))
  res.setHeader("Access-Control-Expose-Headers", "X-Total-Count, X-Page, X-Limit")
}
