/**
 * Export Service (Class-based with Dependency Injection)
 *
 * Handles data export: user debts and admin exports.
 * Uses constructor injection for testability.
 */
import { debts, users, eq, or } from '@repo/db';
import ExcelJS from 'exceljs';
import type { DbClient } from '@/types';
import type { ExportFormat, ExportResult } from '@/types';

/**
 * SECURITY: Mask phone number to protect PII in exports
 * Shows first 3 and last 3 digits, masks the rest
 * Example: +1234567890 → +123****890
 */
function maskPhoneNumber(phone: string | null): string {
  if (!phone || phone.length < 6) return '****';

  const visible = 3;
  const start = phone.slice(0, visible);
  const end = phone.slice(-visible);
  const maskedLength = phone.length - visible * 2;
  const masked = '*'.repeat(Math.max(maskedLength, 4));

  return `${start}${masked}${end}`;
}

/**
 * ExportService class with dependency injection
 */
export class ExportService {
  constructor(private db: DbClient) {}

  /**
   * Export user's own debts
   */
  async exportUserDebts(userId: string, format: ExportFormat = 'xlsx'): Promise<ExportResult> {
    // Fetch debts where user is debtor OR creditor
    const userDebts = await this.db
      .select()
      .from(debts)
      .where(or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)))
      .all();

    if (userDebts.length === 0) {
      return { success: false, error: 'No debts to export' };
    }

    // Get all users for mapping
    const allUsers = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .all();
    const userMap = new Map(allUsers.map((u) => [u.id, { email: u.email, name: u.name }]));

    // Format data
    const data = userDebts.map((d) => {
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
    const allDebts = await this.db.select().from(debts).all();

    if (allDebts.length === 0) {
      return { success: false, error: 'No debts to export' };
    }

    const allUsers = await this.db
      .select({ id: users.id, email: users.email, name: users.name, phone: users.phoneNumber })
      .from(users)
      .all();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const data = allDebts.map((d) => {
      const debtor = userMap.get(d.debtorId ?? '');
      const creditor = userMap.get(d.creditorId ?? '');

      return {
        ID: d.id,
        Debtor: debtor?.name || debtor?.email || d.debtorPhone || d.debtorId || '',
        'Debtor Phone': maskPhoneNumber(debtor?.phone || d.debtorPhone || ''),
        Creditor: creditor?.name || creditor?.email || d.creditorPhone || d.creditorId || '',
        'Creditor Phone': maskPhoneNumber(creditor?.phone || d.creditorPhone || ''),
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
}
