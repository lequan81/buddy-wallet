import { injectable, inject } from "tsyringe";
import type { Result } from "@repo/types";
import { PushService } from "@/app/Services/PushService";
import type { PushPayload } from "@/types/push";

@injectable()
export class SendToUserAction {
    constructor(@inject(PushService) private readonly pushService: PushService) {}

    async execute(userId: string, payload: PushPayload): Promise<Result<{ sent: number; failed: number; errors?: string[] }>> {
        return this.pushService.sendToUser(userId, payload);
    }
}
