import { injectable, inject } from 'tsyringe';
import { HealthService, type StorageReadiness } from '@/app/Services/HealthService';

@injectable()
export class GetStorageConfigReadinessAction {
  constructor(@inject(HealthService) private readonly healthService: HealthService) {}

  execute(): StorageReadiness {
    return this.healthService.getStorageConfigReadiness();
  }
}
