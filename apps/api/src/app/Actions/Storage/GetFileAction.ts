import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { FileService } from "@/app/Services/FileService";

@injectable()
export class GetFileAction {
    constructor(@inject(FileService) private readonly fileService: FileService) {}

    async execute(
        fileId: string,
        requestingUserId: string,
        isAdmin = false
    ): Promise<Awaited<ReturnType<FileService['getFile']>>> {
        return this.fileService.getFile(fileId, requestingUserId, isAdmin);
    }
}
