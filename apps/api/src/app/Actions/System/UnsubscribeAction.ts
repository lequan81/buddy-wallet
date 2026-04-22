import { injectable, inject } from 'tsyringe';
import type { Result } from '@repo/types';
import { PushService } from '@/app/Services/PushService';

@injectable()
export class UnsubscribeAction {
  constructor(@inject(PushService) private readonly pushService: PushService) {}

  async execute(userId: string, endpoint: string): Promise<Result<void>> {
    return this.pushService.unsubscribe(userId, endpoint);
  }
}
