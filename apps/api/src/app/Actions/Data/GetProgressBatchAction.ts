import { injectable, inject } from "tsyringe";
import type { ProgressResult } from "@/types";
import { ImportLogService } from "@/app/Services/ImportLogService";

@injectable()
export class GetProgressBatchAction {
    constructor(@inject(ImportLogService) private readonly logService: ImportLogService) {
    }

    async execute(logIds: string[], userId: string): Promise<{ data: Record<string, ProgressResult> }> {
        const result = await this.logService.getProgressBatch(logIds, userId);
        return result as { data: Record<string, ProgressResult> };
    }
}
