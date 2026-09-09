export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Chuẩn hóa đối tượng phân trang trả về cho toàn bộ API backend
 */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  maxLimit: number = 100,
): PaginatedResult<T> {
  const safeLimit = Math.min(Math.max(1, limit), maxLimit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    items,
    meta: {
      total,
      page,
      limit: safeLimit,
      totalPages,
    },
  };
}
