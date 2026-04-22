import { injectable, inject } from "tsyringe";
import { logger } from "@repo/logger";
import type { ImportRepositoryInterface } from "@/app/Repositories/Contracts/ImportRepositoryInterface";

@injectable()
export class UpdateLogStatusAction {
    constructor(@inject('ImportRepositoryInterface') private readonly importRepo: ImportRepositoryInterface) {
    }

    async execute(id: string, status: 'pending' | 'processing' | 'success' | 'failed' | 'preview', errors: string[] = []): Promise<void> {
        logger.info(`[ImportLogger] Job ${id} status update: ${status}`, { errors });

        await this.importRepo.updateLog(id, {
          status,
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
          completedAt: status === 'success' || status === 'failed' ? new Date() : null
        });
    }
}
