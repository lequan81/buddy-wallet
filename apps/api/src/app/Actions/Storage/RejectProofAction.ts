import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class RejectProofAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(fileId: string, reviewerId: string, reason?: string): Promise<Result<{ debtId: string; uploaderId: string }>> {
        return this.fileService.rejectProof(fileId, reviewerId, reason);
    }
}
