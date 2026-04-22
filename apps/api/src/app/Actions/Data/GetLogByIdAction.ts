import { injectable, inject } from "tsyringe";
import { ImportLogService } from "@/app/Services/ImportLogService";

@injectable()
export class GetLogByIdAction {
    constructor(@inject(ImportLogService) private readonly logService: ImportLogService) {
    }

    async execute(id: string, userId: string) {
        return this.logService.getLogById(id, userId);
    }
}
