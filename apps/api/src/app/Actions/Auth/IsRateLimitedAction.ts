import { injectable, inject } from "tsyringe";
import { RateLimitService } from "@/app/Services/RateLimitService";

@injectable()
export class IsRateLimitedAction {
    constructor(@inject(RateLimitService) private rateLimitService: RateLimitService) {}

    async execute(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): Promise<boolean> {
        const { count } = await this.rateLimitService.getAttempts(key);
        return count >= maxAttempts;
    }
}
