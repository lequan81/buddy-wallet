import { injectable, inject } from "tsyringe";
import type { ActivityFilters, ActivityLogResult } from "@/app/Repositories/Contracts/Types/activity";
import type { ActivityRepositoryInterface } from "@/app/Repositories/Contracts/ActivityRepositoryInterface";

@injectable()
export class GetLogsForUserAction {
    constructor(@inject('ActivityRepositoryInterface') private activityRepo: ActivityRepositoryInterface) {
    }

    async execute(userId: string, filters: ActivityFilters = {}): Promise<ActivityLogResult> {
        return this.activityRepo.findManyByUserId(userId, filters);
    }
}
