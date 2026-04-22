import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import type { FileRepositoryInterface } from "@/app/Repositories/Contracts";

@injectable()
export class GetUserQRCodesAction {
    constructor(@inject('FileRepositoryInterface') private readonly fileRepo: FileRepositoryInterface) {
    }

    async execute(userId: string): Promise<Result<Awaited<ReturnType<FileRepositoryInterface['findByUserIdAndType']>>>> {
        const codes = await this.fileRepo.findByUserIdAndType(userId, 'qr_code');
        return { data: codes };
    }
}
