import { injectable, inject } from "tsyringe";
import type { ActivityFilters, ActivityLogResult } from "@/app/Repositories/Contracts";
import type { ActivityRepositoryInterface } from "@/app/Repositories/Contracts/ActivityRepositoryInterface";

@injectable()
export class GetAllLogsAction {
    constructor(@inject('ActivityRepositoryInterface') private activityRepo: ActivityRepositoryInterface) {
    }

    async execute(filters: ActivityFilters = {}): Promise<ActivityLogResult> {
        return this.activityRepo.findMany(filters);
    }
}
