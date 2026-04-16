'use strict';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 2000;

const parsePagination = (query = {}) => {
  const pageRaw = Number(query.page || DEFAULT_PAGE);
  const limitRaw = Number(query.limit || DEFAULT_LIMIT);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : DEFAULT_PAGE;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildMeta = ({ total, page, limit }) => ({
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

module.exports = { parsePagination, buildMeta, MAX_LIMIT, DEFAULT_LIMIT };
