import { HttpException, HttpStatus } from '@nestjs/common';

/** Stable machine-readable error codes; the web app maps these to friendly copy. */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, message, ...extra }, status);
  }
}
