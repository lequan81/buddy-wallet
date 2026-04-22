import { injectable, inject } from "tsyringe";
import { logger } from "@repo/logger";
import { RateLimitService } from "@/app/Services/RateLimitService";

@injectable()
export class RecordAttemptAction {
    constructor(@inject(RateLimitService) private rateLimitService: RateLimitService) {}

    async execute(key: string, maxAttempts = 5, blockDurationMs = 15 * 60 * 1000): Promise<void> {
        const windowSeconds = Math.ceil(blockDurationMs / 1000);
        const { count } = await this.rateLimitService.increment(key, windowSeconds);

        if (count >= maxAttempts) {
          logger.security(`Rate limit triggered`, { key, count, maxAttempts });
        }
    }
}
