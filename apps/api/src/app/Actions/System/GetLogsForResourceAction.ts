import { injectable, inject } from "tsyringe";
import type { ActivityLog, ActivityResource } from "@repo/types";
import type { ActivityRepositoryInterface } from "@/app/Repositories/Contracts/ActivityRepositoryInterface";

@injectable()
export class GetLogsForResourceAction {
    constructor(@inject('ActivityRepositoryInterface') private activityRepo: ActivityRepositoryInterface) {
    }

    async execute(resource: ActivityResource, resourceId: string): Promise<ActivityLog[]> {
        return this.activityRepo.findByResourceId(resource, resourceId);
    }
}
