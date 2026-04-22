import { injectable, inject } from "tsyringe";
import { RateLimitService } from "@/app/Services/RateLimitService";

@injectable()
export class ClearRateLimitAction {
    constructor(@inject(RateLimitService) private readonly rateLimitService: RateLimitService) {}

    async execute(key: string): Promise<void> {
        await this.rateLimitService.reset(key);
    }
}
