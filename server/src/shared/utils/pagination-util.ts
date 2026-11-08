import { AppConfig } from '../../config/app-config';
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function extractPagination(url: URL): PaginationParams {
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const limitParam = parseInt(url.searchParams.get('limit') || `${AppConfig.pagination.defaultLimit}`, 10);

  const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
  const limit = Math.min(AppConfig.pagination.maxLimit, Math.max(1, isNaN(limitParam) ? AppConfig.pagination.defaultLimit : limitParam));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}