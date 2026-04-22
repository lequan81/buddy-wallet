import { HttpException } from './HttpException';

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableException extends HttpException {
  constructor(service: string) {
    super(503, `${service} is temporarily unavailable`, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableException';
  }
}
