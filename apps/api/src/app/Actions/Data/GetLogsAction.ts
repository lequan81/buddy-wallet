import { injectable, inject } from "tsyringe";
import { ImportLogService } from "@/app/Services/ImportLogService";

@injectable()
export class GetLogsAction {
    constructor(@inject(ImportLogService) private readonly logService: ImportLogService) {
    }

    async execute(userId: string, page: number = 1, limit: number = 10) {
        return this.logService.getLogs(userId, page, limit);
    }
}
