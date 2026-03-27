import { db } from '@repo/db';
import { ImportService as ImportServiceClass } from './import.service';
import { ExportService as ExportServiceClass } from './export.service';
import { SpreadsheetService as SpreadsheetServiceClass } from './spreadsheet.service';
import { ImportLoggerService as ImportLoggerServiceClass } from './import-logger.service';

export const SpreadsheetService = new SpreadsheetServiceClass();
export const ImportLoggerService = new ImportLoggerServiceClass(db);
export const ImportService = new ImportServiceClass(db, SpreadsheetService, ImportLoggerService);
export const ExportService = new ExportServiceClass(db);

export { ImportServiceClass, ExportServiceClass, SpreadsheetServiceClass, ImportLoggerServiceClass };

