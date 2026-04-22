import { injectable, inject } from "tsyringe";
import type { ProgressResult } from "@/types";
import { ImportLogService } from "@/app/Services/ImportLogService";

@injectable()
export class GetProgressAction {
    constructor(@inject(ImportLogService) private readonly logService: ImportLogService) {
    }

    async execute(logId: string, userId: string): Promise<ProgressResult> {
        return this.logService.getProgress(logId, userId);
    }
}
