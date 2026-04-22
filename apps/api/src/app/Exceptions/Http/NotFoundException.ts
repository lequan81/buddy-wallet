import { HttpException } from './HttpException';

/**
 * 404 Not Found
 */
export class NotFoundException extends HttpException {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundException';
  }
}
