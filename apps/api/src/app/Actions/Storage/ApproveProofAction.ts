import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class ApproveProofAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(fileId: string, reviewerId: string): Promise<Result<{ allProofsApproved: boolean; debtId: string; uploaderId: string }>> {
        return this.fileService.approveProof(fileId, reviewerId);
    }
}
