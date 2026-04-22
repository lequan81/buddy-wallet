import { injectable, inject } from "tsyringe";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class GetPendingProofsAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(debtId: string): Promise<Awaited<ReturnType<FileService['getPendingProofs']>>> {
        return this.fileService.getPendingProofs(debtId);
    }
}
