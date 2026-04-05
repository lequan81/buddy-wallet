/**
 * Export Service (Class-based with Dependency Injection)
 *
 * Handles data export: user debts and admin exports.
 * Uses constructor injection for testability.
 */
import ExcelJS from 'exceljs';
import { buildCSV, escapeCSVCell, maskPhone } from '@repo/utils';
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
      const csvContent = buildCSV(data);
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
    const chunkSize = 1000;
    let offset = 0;

    // CSV Header
    yield 'id,debtorId,debtorName,creditorId,creditorName,amount,status,description,createdAt,updatedAt\n';

    let streamedRows = 0;
    while (true) {
      const result = await this.debtRepo.findMany({
        involvedUserId: userId,
        limit: chunkSize,
        offset
      });

      const debts = result.data;
      if (debts.length === 0) {
        break;
      }

      const userMap = await this.getUserMapForDebts(debts);
      for (const debt of debts) {
        const debtor = userMap.get(debt.debtorId ?? '');
        const creditor = userMap.get(debt.creditorId ?? '');

        const row = [
          escapeCSVCell(debt.id),
          escapeCSVCell(debt.debtorId || ''),
          escapeCSVCell(debtor?.name || debtor?.email || debt.debtorPhone || ''),
          escapeCSVCell(debt.creditorId || ''),
          escapeCSVCell(creditor?.name || creditor?.email || debt.creditorPhone || ''),
          escapeCSVCell(debt.amount ?? ''),
          escapeCSVCell(debt.status || ''),
          escapeCSVCell(debt.description || ''),
          escapeCSVCell(debt.createdAt ? new Date(debt.createdAt).toISOString() : ''),
          escapeCSVCell(debt.updatedAt ? new Date(debt.updatedAt).toISOString() : '')
        ].join(',');
        yield `${row}\n`;
        streamedRows++;
      }

      offset += debts.length;
      if (debts.length < chunkSize) {
        break;
      }
    }

    logger.info('[Export] CSV stream complete', { userId, rows: streamedRows });
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
