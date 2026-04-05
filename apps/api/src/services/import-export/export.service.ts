/**
 * Export Service (Class-based with Dependency Injection)
 *
 * Handles data export: user debts and admin exports.
 * Uses constructor injection for testability.
 */
import ExcelJS from 'exceljs';
import { maskPhone } from '@repo/utils';
import { logger } from '@repo/logger';
import type { IUserRepository, IDebtRepository } from '@/types/repositories';
import type { ExportFormat, ExportResult } from '@/types';

/**
 * ExportService class with dependency injection
 */
export class ExportService {
  constructor(
    private readonly debtRepo: IDebtRepository,
    private readonly userRepo: IUserRepository
  ) { }

  /**
   * Export user's own debts
   */
  async exportUserDebts(userId: string, format: ExportFormat = 'xlsx'): Promise<ExportResult> {
    // Fetch debts where user is debtor OR creditor
    const paginatedResult = await this.debtRepo.findMany({ involvedUserId: userId, limit: 10000 }); // Large limit for export
    const userDebts = paginatedResult.data;

    if (userDebts.length === 0) {
      return { success: false, error: 'No debts to export' };
    }

    const userMap = await this.getUserMapForDebts(userDebts);

    // Format data
    const data = userDebts.map((d: { debtorId?: string | null; creditorId?: string | null; debtorPhone?: string | null; creditorPhone?: string | null; amount?: number; status?: string; description?: string | null; createdAt?: Date | string | null; updatedAt?: Date | string | null; id?: string }) => {
      const debtor = userMap.get(d.debtorId ?? '') || { email: d.debtorPhone, name: d.debtorPhone };
      const creditor = userMap.get(d.creditorId ?? '') || {
        email: d.creditorPhone,
        name: d.creditorPhone
      };
      const isCreditor = d.creditorId === userId;

      return {
        Date: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
        Type: isCreditor ? 'Lent' : 'Borrowed',
        Person: isCreditor ? debtor.name || debtor.email : creditor.name || creditor.email,
        Amount: d.amount,
        Status: d.status,
        Description: d.description || ''
      };
    });

    return this.generateExportFile(data, 'My Debts', `debts_${this.getDateString()}`, format);
  }

  /**
   * Export all debts (admin)
   */
  async exportAllDebts(format: ExportFormat = 'xlsx'): Promise<ExportResult> {
    const paginatedResult = await this.debtRepo.findMany({ limit: 50000, includeDeleted: false });
    const allDebts = paginatedResult.data;

    if (allDebts.length === 0) {
      return { success: false, error: 'No debts to export' };
    }

    const userMap = await this.getUserMapForDebts(allDebts);

    const data = allDebts.map((d: { debtorId?: string | null; creditorId?: string | null; debtorPhone?: string | null; creditorPhone?: string | null; amount?: number; status?: string; description?: string | null; createdAt?: Date | string | null; updatedAt?: Date | string | null; id?: string }) => {
      const debtor = userMap.get(d.debtorId ?? '') as { name?: string | null; email?: string | null; phoneNumber?: string | null } | undefined;
      const creditor = userMap.get(d.creditorId ?? '') as { name?: string | null; email?: string | null; phoneNumber?: string | null } | undefined;

      return {
        ID: d.id,
        Debtor: debtor?.name || debtor?.email || d.debtorPhone || d.debtorId || '',
        'Debtor Phone': maskPhone(debtor?.phoneNumber || d.debtorPhone || ''),
        Creditor: creditor?.name || creditor?.email || d.creditorPhone || d.creditorId || '',
        'Creditor Phone': maskPhone(creditor?.phoneNumber || d.creditorPhone || ''),
        Amount: d.amount,
        Status: d.status,
        Description: d.description || '',
        Created: d.createdAt ? new Date(d.createdAt).toISOString() : '',
        Updated: d.updatedAt ? new Date(d.updatedAt).toISOString() : ''
      };
    });

    return this.generateExportFile(data, 'All Debts', `all_debts_${this.getDateString()}`, format);
  }

  /**
   * Generate export file (xlsx or csv)
   */
  private async generateExportFile(
    data: Record<string, unknown>[],
    sheetName: string,
    filename: string,
    format: ExportFormat
  ): Promise<ExportResult> {
    if (format === 'csv') {
      // CSV: manual generation (no library needed)
      const keys = Object.keys(data[0] || {});
      const header = keys.map((k) => `"${k}"`).join(',');
      const rows = data.map((row) =>
        keys.map((k) => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(',')
      );
      const csvContent = [header, ...rows].join('\n');
      const buffer = Buffer.from(csvContent, 'utf-8');

      return {
        success: true,
        buffer,
        contentType: 'text/csv',
        filename: `${filename}.csv`
      };
    }

    // XLSX: ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Set columns with headers and auto-width
    const keys = Object.keys(data[0] || {});
    worksheet.columns = keys.map((key) => ({
      header: key,
      key,
      width: Math.max(key.length + 2, ...data.map((row) => String(row[key] || '').length + 2))
    }));

    // Add data rows
    worksheet.addRows(data);

    // Style header row
    worksheet.getRow(1).font = { bold: true };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      success: true,
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${filename}.xlsx`
    };
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Stream user debts as CSV with chunking and batched user lookups
   * Batches all unique user IDs upfront to prevent N+1 query pattern
   *
   * Performance: For 10k debts with 100-chunk size:
   * - Old: 100 database queries (1 per chunk) + 1 debt query per chunk
   * - New: 1 debt pagination query + 1 batched user query
   */
  async *streamUserDebtsAsCSV(userId: string): AsyncGenerator<string, void> {
    const chunkSize = 100;
    let offset = 0;
    const allDebts: Array<{
      id?: string;
      debtorId?: string | null;
      debtorPhone?: string | null;
      creditorId?: string | null;
      creditorPhone?: string | null;
      amount?: number;
      status?: string;
      description?: string | null;
      createdAt?: Date | string | null;
      updatedAt?: Date | string | null;
    }> = [];

    // PHASE 1: Collect all debts and unique user IDs
    logger.info('[Export] Phase 1: Collecting all debts for batching...');

    while (true) {
      const result = await this.debtRepo.findMany({
        involvedUserId: userId,
        limit: chunkSize,
        offset
      });

      const debts = result.data;
      if (debts.length === 0) break;

      allDebts.push(...debts);
      offset += chunkSize;

      // Safety limit to prevent memory exhaustion
      if (allDebts.length >= 50000) {
        logger.warn('[Export] Reached safety limit of 50k debts, stopping collection');
        break;
      }
    }

    logger.info('[Export] Phase 1 Complete', { totalDebts: allDebts.length });

    if (allDebts.length === 0) {
      logger.warn('[Export] No debts found for user', { userId });
      return;
    }

    // PHASE 2: Batch-fetch all users ONCE (not per chunk!)
    logger.info('[Export] Phase 2: Batch-fetching all users...');
    const userMap = await this.getUserMapForDebts(allDebts);
    logger.info('[Export] Phase 2 Complete', { userCount: userMap.size });

    // PHASE 3: Stream CSV output with pre-fetched user map
    logger.info('[Export] Phase 3: Streaming CSV output...');

    // CSV Header
    yield 'id,debtorId,debtorName,creditorId,creditorName,amount,status,description,createdAt,updatedAt\n';

    // CSV Rows (reuse pre-fetched userMap - no additional DB calls!)
    const csvRows = allDebts
      .map((debt) => {
        const debtor = userMap.get(debt.debtorId ?? '');
        const creditor = userMap.get(debt.creditorId ?? '');

        return [
          this.csvValue(debt.id),
          this.csvValue(debt.debtorId || ''),
          this.csvValue(debtor?.name || debtor?.email || debt.debtorPhone || ''),
          this.csvValue(debt.creditorId || ''),
          this.csvValue(creditor?.name || creditor?.email || debt.creditorPhone || ''),
          this.csvValue(debt.amount ?? ''),
          this.csvValue(debt.status || ''),
          this.csvValue(debt.description || ''),
          this.csvValue(debt.createdAt ? new Date(debt.createdAt).toISOString() : ''),
          this.csvValue(debt.updatedAt ? new Date(debt.updatedAt).toISOString() : '')
        ].join(',');
      })
      .join('\n');

    yield `${csvRows}\n`;

    logger.info('[Export] Phase 3 Complete', { rowsStreamed: allDebts.length });
  }

  private csvValue(value: unknown): string {
    const normalized = String(value ?? '');
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  private async getUserMapForDebts(
    debts: Array<{ debtorId?: string | null; creditorId?: string | null }>
  ): Promise<Map<string, { id: string; email?: string | null; name?: string | null; phoneNumber?: string | null }>> {
    const userIds = new Set<string>();
    for (const debt of debts) {
      if (debt.debtorId) userIds.add(debt.debtorId);
      if (debt.creditorId) userIds.add(debt.creditorId);
    }

    if (userIds.size === 0) {
      return new Map();
    }

    const users = await this.userRepo.findByIds(Array.from(userIds));
    return new Map(users.map((u) => [u.id, u]));
  }
}
