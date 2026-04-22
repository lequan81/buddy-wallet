import { injectable, inject } from "tsyringe";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class GetProofsForDebtAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(debtId: string): Promise<Awaited<ReturnType<FileService['getProofsForDebt']>>> {
        return this.fileService.getProofsForDebt(debtId);
    }
}
