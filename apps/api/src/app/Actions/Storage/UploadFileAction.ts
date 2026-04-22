import { injectable, inject } from "tsyringe";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class UploadFileAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(
        file: Parameters<FileService['uploadFile']>[0],
        userId: Parameters<FileService['uploadFile']>[1],
        type: Parameters<FileService['uploadFile']>[2],
        relatedDebtId?: Parameters<FileService['uploadFile']>[3]
    ): Promise<Awaited<ReturnType<FileService['uploadFile']>>> {
        return this.fileService.uploadFile(file, userId, type, relatedDebtId);
    }
}
