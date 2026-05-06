/**
 * Storage Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Upload file schema
export const UploadFileSchema = t.Object({
  file: t.File({
    type: 'image/*',
    maxSize: '10m',
    error: 'File must be an image and less than 10MB'
  })
});

// Delete file schema
export const DeleteFileSchema = t.Object({
  key: t.String({
    error: 'File key is required'
  })
});

// List files query schema
export const ListFilesQuerySchema = t.Object({
  prefix: t.Optional(t.String()),
  page: t.Optional(t.Number({
    minimum: 1,
    default: 1
  })),
  limit: t.Optional(t.Number({
    minimum: 1,
    maximum: 100,
    default: 20
  }))
});

// Response schemas
export const FileResponseSchema = t.Object({
  key: t.String(),
  url: t.String(),
  size: t.Number(),
  contentType: t.String(),
  uploadedAt: t.Date()
});

export const FileListResponseSchema = t.Object({
  data: t.Array(FileResponseSchema),
  meta: t.Object({
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number()
  })
});
