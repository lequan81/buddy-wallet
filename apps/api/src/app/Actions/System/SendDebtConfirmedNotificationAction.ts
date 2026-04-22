import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { PushService } from "@/app/Services/PushService";

@injectable()
export class SendDebtConfirmedNotificationAction {
    constructor(@inject(PushService) private readonly pushService: PushService) {}

    async execute(params: {
        userId: string;
        confirmerName: string;
        amount: number;
        description: string;
        debtId: string;
    }): Promise<Result<{ sent: number; failed: number; errors?: string[] }>> {
        return this.pushService.sendDebtConfirmedNotification(params);
    }
}
