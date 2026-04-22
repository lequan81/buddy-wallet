import { injectable, inject } from 'tsyringe';
import { HealthService } from '@/app/Services/HealthService';

@injectable()
export class GetSystemHealthAction {
  constructor(@inject(HealthService) private readonly healthService: HealthService) {}

  execute() {
    return this.healthService.getSystemHealth();
  }
}
