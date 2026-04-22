/**
 * Base HTTP exception
 */
export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code: string = 'HTTP_ERROR'
  ) {
    super(message);
    this.name = 'HttpException';
  }
}
