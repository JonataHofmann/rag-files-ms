import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException | Error | any, host: ArgumentsHost) {
    const logger = new Logger(GlobalExceptionFilter.name);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const errorCode = exception.response?.data?.errorCode || 'DEFAULT_ERROR';
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const data: string | any =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Serviço indisponível. Tente novamente mais tarde.' };
    if (exception instanceof HttpException || exception instanceof Error) {
      const message = data ? this.transformMessage(data) : exception.message;
      const trace = exception.stack;

      logger.error(
        `Error: ${status} - path: ${request.url} - message: ${message} \n${trace}`,
      );

      response.status(status).send({
        message: message,
        statusCode: status,
        errorCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        trace,
      });
    } else {
      response.status(status).send({
        message: 'Erro não tratado',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }

  private transformMessage(
    data:
      | {
          message?: string | string[];
          error?: string;
          error_description?: string;
        }
      | string,
  ): string {
    if (typeof data === 'string') return data;
    const { message, error, error_description } = data;
    if (message && Array.isArray(message)) return message.join(', ');
    if (!message && (error || error_description))
      return error_description || '';
    return message || '';
  }
}
