import { injectable, inject } from "tsyringe";
import { ExportService } from "@/app/Services/ExportService";

@injectable()
export class StreamUserDebtsAsCSVAction {
    constructor(
      @inject(ExportService) private readonly exportService: ExportService
    ) {}

    /**
     * Stream user debts as CSV
     * Delegates to ExportService
     */
    execute(userId: string): AsyncGenerator<string, void> {
        return this.exportService.streamUserDebtsAsCSV(userId);
    }
}
