import { services } from '@/plugins/services.plugin';
import { ImportService as ImportServiceClass } from './import.service';
import { ExportService as ExportServiceClass } from './export.service';
import { SpreadsheetService as SpreadsheetServiceClass } from './spreadsheet.service';
import { ImportLoggerService as ImportLoggerServiceClass } from './import-logger.service';

export const SpreadsheetService = services.spreadsheetService;
export const ImportLoggerService = services.importLoggerService;
export const ImportService = services.importService;
export const ExportService = services.exportService;

export {
  ImportServiceClass,
  ExportServiceClass,
  SpreadsheetServiceClass,
  ImportLoggerServiceClass
};

