import { injectable, inject } from "tsyringe";
import { RateLimitService } from "@/app/Services/RateLimitService";

@injectable()
export class GetRateLimitResetTimeAction {
    constructor(@inject(RateLimitService) private readonly rateLimitService: RateLimitService) {}

    async execute(key: string): Promise<number | null> {
        return await this.rateLimitService.getResetTime(key);
    }
}
