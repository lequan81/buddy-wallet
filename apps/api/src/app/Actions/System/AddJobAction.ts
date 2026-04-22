import { injectable, inject } from 'tsyringe';
import type { JobType, JobPayload } from '@repo/types';
import { JobsService } from '@/app/Services/JobsService';

@injectable()
export class AddJobAction {
  constructor(@inject(JobsService) private readonly jobsService: JobsService) {}

  async execute(type: JobType, payload: JobPayload): Promise<string> {
    return this.jobsService.addJob(type, payload);
  }
}
