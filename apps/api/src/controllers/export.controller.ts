import { Elysia, t } from 'elysia';
import { db, debts, users, eq, or } from '@repo/db';
import { BE_ERRORS, createError } from '@repo/errors';
import { sessionAuthPlugin } from '@plugins/session-auth';
import { accessControlPlugin } from '@plugins/access-control';
import * as XLSX from 'xlsx';

export const exportController = new Elysia({ prefix: '/export' })
  .use(sessionAuthPlugin)
  .use(accessControlPlugin)

  // Export user's own debts as Excel
  .get('/debts', async ({ user, set, query }) => {
    const format = (query as any)?.format || 'xlsx';

    // Fetch debts where user is debtor OR creditor
    const userDebts = await db
      .select()
      .from(debts)
      .where(or(eq(debts.debtorId, user!.id), eq(debts.creditorId, user!.id)))
      .all();

    if (userDebts.length === 0) {
      set.status = 404;
      return createError(BE_ERRORS.EXPORT_NO_DATA);
    }

    // Get all user emails for mapping
    const allUsers = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .all();
    const userMap = new Map(allUsers.map((u) => [u.id, { email: u.email, name: u.name }]));

    // Format data for export
    const data = userDebts.map((d) => {
      const debtor = userMap.get(d.debtorId ?? '') || { email: d.debtorPhone, name: d.debtorPhone };
      const creditor = userMap.get(d.creditorId ?? '') || {
        email: d.creditorPhone,
        name: d.creditorPhone
      };
      const isCreditor = d.creditorId === user!.id;

      return {
        Date: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
        Type: isCreditor ? 'Lent' : 'Borrowed',
        Person: isCreditor ? debtor.name || debtor.email : creditor.name || creditor.email,
        Amount: d.amount,
        Status: d.status,
        Description: d.description || ''
      };
    });

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'My Debts');

    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...data.map((row) => String((row as any)[key] || '').length))
    }));
    worksheet['!cols'] = colWidths;

    // Generate file
    const filename = `debts_${new Date().toISOString().split('T')[0]}`;
    let buf: Buffer;
    let contentType: string;
    let extension: string;

    if (format === 'csv') {
      buf = Buffer.from(XLSX.utils.sheet_to_csv(worksheet), 'utf-8');
      contentType = 'text/csv';
      extension = 'csv';
    } else {
      buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    }

    set.headers['Content-Type'] = contentType;
    set.headers['Content-Disposition'] = `attachment; filename="${filename}.${extension}"`;

    console.log(`[Export] User ${user!.id}: ${userDebts.length} records as ${extension}`);

    return buf;
  })

  // Admin: Export all debts
  .get('/admin/debts', async ({ user, set, query }) => {
    if (user?.role !== 'admin') {
      set.status = 403;
      return createError(BE_ERRORS.EXPORT_FAILED, 'Admin access required');
    }

    const format = (query as any)?.format || 'xlsx';
    const allDebts = await db.select().from(debts).all();

    if (allDebts.length === 0) {
      set.status = 404;
      return createError(BE_ERRORS.EXPORT_NO_DATA);
    }

    const allUsers = await db
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
        'Debtor Phone': debtor?.phone || d.debtorPhone || '',
        Creditor: creditor?.name || creditor?.email || d.creditorPhone || d.creditorId || '',
        'Creditor Phone': creditor?.phone || d.creditorPhone || '',
        Amount: d.amount,
        Status: d.status,
        Description: d.description || '',
        Created: d.createdAt ? new Date(d.createdAt).toISOString() : '',
        Updated: d.updatedAt ? new Date(d.updatedAt).toISOString() : ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Debts');

    const filename = `all_debts_${new Date().toISOString().split('T')[0]}`;
    let buf: Buffer;
    let contentType: string;
    let extension: string;

    if (format === 'csv') {
      buf = Buffer.from(XLSX.utils.sheet_to_csv(worksheet), 'utf-8');
      contentType = 'text/csv';
      extension = 'csv';
    } else {
      buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    }

    set.headers['Content-Type'] = contentType;
    set.headers['Content-Disposition'] = `attachment; filename="${filename}.${extension}"`;

    console.log(`[Export] Admin: ${allDebts.length} records as ${extension}`);

    return buf;
  });
