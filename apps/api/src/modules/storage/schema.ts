/**
 * Storage Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';
import * as v from 'valibot';

// Upload file schema — uses Elysia's t.File() (no valibot equivalent for file uploads)
export const UploadFileSchema = t.Object({
  file: t.File({
    type: 'image/*',
    maxSize: '10m',
    error: 'File must be an image and less than 10MB'
  })
});

// Delete file schema
export const DeleteFileSchema = v.object({
  key: v.string()
});

// List files query schema
export const ListFilesQuerySchema = v.object({
  prefix: v.optional(v.string()),
  page: v.optional(v.pipe(v.number(), v.minValue(1))),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))
});

// Response schemas
export const FileResponseSchema = v.object({
  key: v.string(),
  url: v.string(),
  size: v.number(),
  contentType: v.string(),
  uploadedAt: v.date()
});

export const FileListResponseSchema = v.object({
  data: v.array(FileResponseSchema),
  meta: v.object({
    total: v.number(),
    page: v.number(),
    limit: v.number(),
    totalPages: v.number()
  })
});
