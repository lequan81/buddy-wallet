import { injectable, inject } from "tsyringe";
import type { ImportConfig, ImportResult } from "@/app/Repositories/Contracts/Types/import";
import type { CurrentUser } from "@/types";
import { ImportProcessingService } from "@/app/Services/ImportProcessingService";

@injectable()
export class ImportDebtsAction {
    constructor(@inject(ImportProcessingService) private readonly processingService: ImportProcessingService) {
    }

    async execute(file: File, config: ImportConfig, currentUser: CurrentUser, previewLogId?: string, logId?: string): Promise<ImportResult> {
        return this.processingService.importDebts(file, config, currentUser, previewLogId, logId);
    }
}
