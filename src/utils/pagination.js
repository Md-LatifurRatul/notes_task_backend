import { HttpError } from './http-error.js';

export function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'page must be a positive integer and limit must be between 1 and 100');
  }
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(total, page, limit) {
  return { page, limit, total, pages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 };
}
