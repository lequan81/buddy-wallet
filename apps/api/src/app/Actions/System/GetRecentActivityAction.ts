import { injectable, inject } from "tsyringe";
import type { ActivityLog } from "@repo/types";
import type { ActivityRepositoryInterface } from "@/app/Repositories/Contracts/ActivityRepositoryInterface";

@injectable()
export class GetRecentActivityAction {
    constructor(@inject('ActivityRepositoryInterface') private activityRepo: ActivityRepositoryInterface) {
    }

    async execute(userId: string, limit = 10): Promise<ActivityLog[]> {
        return this.activityRepo.findRecentByUserId(userId, limit);
    }
}
