import { injectable, inject } from 'tsyringe';
import { PushService } from '@/app/Services/PushService';

@injectable()
export class CleanupAction {
  constructor(@inject(PushService) private readonly pushService: PushService) {}

  async execute(): Promise<number> {
    return this.pushService.cleanup();
  }
}
