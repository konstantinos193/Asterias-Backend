import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        details = (exceptionResponse as any).details || (exceptionResponse as any).errors;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof MongooseError.ValidationError) {
      // Sanitize Mongoose validation errors — don't expose field names/constraints
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      this.logger.warn(`Mongoose validation error on ${request.method} ${request.url}`);
    } else if ((exception as any)?.code === 11000) {
      // MongoDB duplicate key — don't expose which field
      status = HttpStatus.CONFLICT;
      message = 'A record with the provided data already exists';
    } else if (typeof (exception as any)?.type === 'string' && (exception as any).type.startsWith('Stripe')) {
      // A refusal from Stripe, not a fault of ours: "amount too large", "charge
      // already refunded", "this charge is disputed". The message is the one
      // thing the owner can act on, so it is passed through rather than
      // flattened to "Internal server error".
      //
      // This lived in a `paymentError()` helper that each payment handler in
      // AdminController had to remember to call from its own catch block. Doing
      // it here covers every route that touches Stripe, including the ones
      // written after the helper.
      status = HttpStatus.BAD_GATEWAY;
      message = `Stripe: ${(exception as any).message}`;
      this.logger.warn(`Stripe refused ${request.method} ${request.url}: ${message}`);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      this.logger.error('Unexpected error:', exception);
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { 
        stack: exception instanceof Error ? exception.stack : undefined 
      }),
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }
}
