import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class DeleteFileAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(fileId: string, userId: string): Promise<Result<void>> {
        return this.fileService.deleteFile(fileId, userId);
    }
}
