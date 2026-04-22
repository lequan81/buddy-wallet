import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { ExportService, type ExportData } from "@/app/Services/ExportService";
import type { ExportFormat } from "@/types";

@injectable()
export class ExportAllDebtsAction {
    constructor(
      @inject(ExportService) private readonly exportService: ExportService
    ) {}

    async execute(format: ExportFormat = 'xlsx'): Promise<Result<ExportData>> {
        return this.exportService.exportAllDebts(format);
    }
}
