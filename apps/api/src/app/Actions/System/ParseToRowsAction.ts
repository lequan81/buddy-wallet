import { injectable, inject } from "tsyringe";
import { Workbook } from "exceljs";
import { Readable } from "node:stream";
import { parseCSV } from "@repo/utils";

@injectable()
export class ParseToRowsAction {
    async execute(file: File): Promise<string[][]> {
        const isCSV = file.name.toLowerCase().endsWith('.csv');

        if (isCSV) {
          // CSV: use shared parser for robust quote/newline handling.
          const text = await file.text();
          return parseCSV(text);
        }

        const allRows: string[][] = [];
        const workbook = new Workbook();

        // @ts-expect-error - Web Stream to Node Stream incompatibility
        const nodeStream = Readable.fromWeb(file.stream());
        await workbook.xlsx.read(nodeStream);

        const worksheet = workbook.worksheets[0];
        if (worksheet) {
          worksheet.eachRow({ includeEmpty: true }, (row) => {
            const rowValues: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell) => {
              rowValues.push(cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
            });
            allRows.push(rowValues);
          });
        }

        return allRows;
    }
}
