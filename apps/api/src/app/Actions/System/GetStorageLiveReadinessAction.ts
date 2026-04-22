import { injectable, inject } from 'tsyringe';
import { HealthService, type StorageReadiness } from '@/app/Services/HealthService';

@injectable()
export class GetStorageLiveReadinessAction {
  constructor(@inject(HealthService) private readonly healthService: HealthService) {}

  async execute(): Promise<StorageReadiness> {
    return this.healthService.getStorageLiveReadiness();
  }
}
