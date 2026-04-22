import { injectable, inject } from "tsyringe";
import type { LogActivityInput } from "@/app/Repositories/Contracts/Types/activity";
import type { ActivityRepositoryInterface } from "@/app/Repositories/Contracts/ActivityRepositoryInterface";

@injectable()
export class LogAction {
    constructor(@inject('ActivityRepositoryInterface') private activityRepo: ActivityRepositoryInterface) {
    }

    async execute(input: LogActivityInput): Promise<void> {
        await this.activityRepo.create({
          userId: input.userId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId || null,
          changes: input.changes || null,
          metadata: input.metadata || null,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
          location: input.location || null
        });
    }
}
