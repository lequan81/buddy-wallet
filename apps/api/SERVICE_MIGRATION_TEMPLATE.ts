/**
 * TEMPLATE: [ResourceName]Service - Example of new DI pattern
 * 
 * Use this template when migrating services from src/services/ to src/app/Services/
 * 
 * Key patterns:
 * 1. Use @injectable() decorator for tsyringe DI
 * 2. Use @inject() for constructor dependencies
 * 3. Return Result<T> = ok(data) | err(code) from all methods
 * 4. Use error codes from @repo/errors (GEN_ERRORS, BE_ERRORS)
 * 5. Include logger from @repo/logger for error tracking
 */

import { injectable, inject } from 'tsyringe';
import { GEN_ERRORS, BE_ERRORS } from '@repo/errors/backend';
import { ok, err } from '@lib/result';
import { logger } from '@repo/logger';
import type { Result } from '@repo/types';

// Import repository interfaces - use interfaces not concrete classes
import type { IResourceRepository } from '@app/Repositories/Contracts/ResourceRepositoryInterface';

/**
 * [ResourceName]Service - Business logic for [resource]
 * Migrated from services/[resource]/[resource].service.ts
 */
@injectable()
export class ResourceService {
  constructor(
    // Constructor injection via tsyringe
    @inject('ResourceRepository') private resourceRepository: IResourceRepository,
    @inject('Logger') private _logger: typeof logger,
    // Optional: other service dependencies
    // @inject(OtherService) private otherService: OtherService,
  ) {}

  /**
   * Create resource
   * @param data Resource creation input
   * @returns Result with created resource or error code
   */
  async create(data: {
    name: string;
    // ... other required fields
  }): Promise<Result<any>> {
    try {
      // Validate input
      if (!data.name || data.name.trim().length === 0) {
        return err(GEN_ERRORS.INVALID_INPUT.code);
      }

      // Check for unique constraints
      // const existing = await this.resourceRepository.findByName(data.name);
      // if (existing) {
      //   return err(BE_ERRORS.RESOURCE_ALREADY_EXISTS.code);
      // }

      // Perform creation
      const created = await this.resourceRepository.create(data);
      
      if (!created) {
        return err(GEN_ERRORS.UNKNOWN.code);
      }

      this._logger.info('Resource created', { id: created.id });
      return ok(created);
    } catch (error) {
      this._logger.error('Failed to create resource', { error: String(error), data });
      return err(GEN_ERRORS.UNKNOWN.code);
    }
  }

  /**
   * Get resource by ID
   * @param id Resource ID
   * @returns Result with resource or error code
   */
  async getById(id: string): Promise<Result<any>> {
    try {
      if (!id) {
        return err(GEN_ERRORS.INVALID_INPUT.code);
      }

      const resource = await this.resourceRepository.findById(id);
      
      if (!resource) {
        return err(GEN_ERRORS.NOT_FOUND.code);
      }

      return ok(resource);
    } catch (error) {
      this._logger.error('Failed to get resource', { error: String(error), id });
      return err(GEN_ERRORS.UNKNOWN.code);
    }
  }

  /**
   * Get all resources with pagination
   * @param limit Items per page
   * @param offset Starting position
   * @returns Result with paginated results or error code
   */
  async getAll(limit: number = 50, offset: number = 0): Promise<Result<any>> {
    try {
      const { data, total } = await this.resourceRepository.findMany(limit, offset);

      return ok({
        items: data,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      this._logger.error('Failed to get resources', { error: String(error) });
      return err(GEN_ERRORS.UNKNOWN.code);
    }
  }

  /**
   * Update resource
   * @param id Resource ID
   * @param updates Fields to update
   * @returns Result with updated resource or error code
   */
  async update(
    id: string,
    updates: {
      name?: string;
      // ... other optional fields
    }
  ): Promise<Result<any>> {
    try {
      // Verify resource exists
      const resource = await this.resourceRepository.findById(id);
      if (!resource) {
        return err(GEN_ERRORS.NOT_FOUND.code);
      }

      // Check for empty updates
      if (Object.values(updates).every(v => v === undefined)) {
        return err(GEN_ERRORS.INVALID_INPUT.code);
      }

      // Validate unique constraints if needed
      // if (updates.name && updates.name !== resource.name) {
      //   const existing = await this.resourceRepository.findByName(updates.name);
      //   if (existing) {
      //     return err(BE_ERRORS.RESOURCE_ALREADY_EXISTS.code);
      //   }
      // }

      const updated = await this.resourceRepository.update(id, updates);
      
      if (!updated) {
        return err(GEN_ERRORS.UNKNOWN.code);
      }

      this._logger.info('Resource updated', { id });
      return ok(updated);
    } catch (error) {
      this._logger.error('Failed to update resource', { error: String(error), id });
      return err(GEN_ERRORS.UNKNOWN.code);
    }
  }

  /**
   * Delete resource
   * @param id Resource ID
   * @returns Result with void or error code
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      // Verify resource exists
      const resource = await this.resourceRepository.findById(id);
      if (!resource) {
        return err(GEN_ERRORS.NOT_FOUND.code);
      }

      // Optional: Check for dependencies that would break on delete
      // if (await this.hasActiveDependencies(id)) {
      //   return err(BE_ERRORS.RESOURCE_HAS_DEPENDENCIES.code);
      // }

      await this.resourceRepository.delete(id);
      
      this._logger.info('Resource deleted', { id });
      return ok(undefined);
    } catch (error) {
      this._logger.error('Failed to delete resource', { error: String(error), id });
      return err(GEN_ERRORS.UNKNOWN.code);
    }
  }
}
