import { PaginationInput } from './pagination-input.type';
import { Pagination } from './pagination.type';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function normalizePagination(input: PaginationInput): Pagination {
  return {
    take: Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    skip: input.offset ?? 0,
  };
}
