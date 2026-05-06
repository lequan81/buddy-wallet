/**
 * Data/Import-Export Handlers
 * @logicType http
 */

import { db } from '@/providers/database';
import { UserRepository } from '@/repositories/user/user.repo';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { BankAccountRepository } from '@/repositories/bank/bank-account.repo';
import { BE_ERRORS } from '@repo/errors';
import { apiSuccess, apiError } from '@/commons/http/response';
import {
  validateExportType, validateExportFormat, validateDateRange,
  convertToCSV, formatExportMetadata, formatImportResult
} from '../services/data.service';
import type { ExportDataContext, ExportFormat, ImportDataContext } from '../types/handler.types';

const ALLOWED_FORMATS: ExportFormat[] = ['json', 'csv'];
type ExportItem = Record<string, unknown>;

const exportRegistry: Record<string, {
  requiresAdmin: boolean;
  fetch: (userId: string) => Promise<ExportItem[]>;
}> = {
  debts: {
    requiresAdmin: false,
    fetch: async (userId) => {
      const debtRepo = new DebtRepository(db);
      const result = await debtRepo.findMany({ involvedUserId: userId, limit: 10000 });
      return (result.items || []) as ExportItem[];
    }
  },
  users: {
    requiresAdmin: true,
    fetch: async () => {
      const userRepo = new UserRepository(db);
      const result = await userRepo.findMany(10000, 0);
      return (result.data || []) as ExportItem[];
    }
  },
  'bank-accounts': {
    requiresAdmin: false,
    fetch: async (userId) => {
      const bankRepo = new BankAccountRepository(db);
      const result = await bankRepo.findByUserId(userId, 10000, 0);
      return (result.data || []) as ExportItem[];
    }
  }
};

export const data = {
  /** GET /data/export */
  exportData: async ({ query, user }: ExportDataContext) => {
    const { type, format = 'json', startDate, endDate } = query;

    const validations = [
      validateExportType(type, Object.keys(exportRegistry)),
      validateExportFormat(format, ALLOWED_FORMATS),
      validateDateRange(startDate, endDate)
    ];

    for (const v of validations) {
      if ('code' in v) {
        return apiError(BE_ERRORS.INVALID_INPUT, v.error);
      }
    }

    const config = exportRegistry[type];
    if (!config) {
      return apiError(BE_ERRORS.INVALID_INPUT, `Unknown export type: ${type}`);
    }
    if (config.requiresAdmin && user.role !== 'admin') {
      return apiError(BE_ERRORS.PERMISSION_DENIED);
    }

    const items = await config.fetch(user.id);

    if (format === 'csv') {
      if (items.length === 0) return new Response('', { headers: { 'Content-Type': 'text/csv' } });
      const headers = Object.keys(items[0] || {});
      const csvContent = convertToCSV(items, headers);
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}_export.csv"`
        }
      });
    }

    return apiSuccess(items, undefined, formatExportMetadata(type, format, items.length) as unknown as Record<string, unknown>);
  },

  /** POST /data/import — STUB: not yet fully implemented */
  importData: async ({ body }: ImportDataContext) => {
    const { type, format, data: importData } = body;

    const validations = [
      validateExportType(type, Object.keys(exportRegistry)),
      validateExportFormat(format, ALLOWED_FORMATS)
    ];

    for (const v of validations) {
      if ('code' in v) {
        return apiError(BE_ERRORS.INVALID_INPUT, v.error);
      }
    }

    // TODO: Implement actual data insertion per type using repositories
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    if (Array.isArray(importData)) {
      imported = importData.length;
    } else {
      failed = 1;
      errors.push('Data must be an array');
    }

    return apiSuccess(formatImportResult(imported, failed, errors), 'Import processed (stub)');
  }
};
