import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { PushService } from "@/app/Services/PushService";

@injectable()
export class SendDebtCreatedNotificationAction {
    constructor(@inject(PushService) private readonly pushService: PushService) {}

    async execute(params: {
        userId: string;
        creatorName: string;
        amount: number;
        description: string;
        debtId: string;
        isCreditor: boolean;
    }): Promise<Result<{ sent: number; failed: number; errors?: string[] }>> {
        return this.pushService.sendDebtCreatedNotification(params);
    }
}
