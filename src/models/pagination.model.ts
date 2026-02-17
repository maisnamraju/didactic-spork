export interface CursorPaginationQuery {
  limit: number;
  cursor: number | null;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  next_cursor: number | null;
}
