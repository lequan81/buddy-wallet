import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { ExportService, type ExportData } from "@/app/Services/ExportService";
import type { ExportFormat } from "@/types";

@injectable()
export class ExportUserDebtsAction {
    constructor(
      @inject(ExportService) private readonly exportService: ExportService
    ) {}

    async execute(userId: string, format: ExportFormat = 'xlsx'): Promise<Result<ExportData>> {
        return this.exportService.exportUserDebts(userId, format);
    }
}
