import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

import { CorrelationIdService } from '../services/correlation-id.service';
import { ElasticsearchTransport } from 'winston-elasticsearch';

@Injectable()
export class AppLogger implements LoggerService {
  private logger: ReturnType<typeof createLogger>;
  private isDev: boolean =
    process.env.APP_ENV === 'dev' || !process.env.APP_ENV;

  constructor(private readonly correlationIdService: CorrelationIdService) {
    const esTransportOpts = {
      level: 'silly',
      clientOpts: {
        node: process.env.ELASTIC_URL!,
        auth: {
          username: process.env.ELASTIC_USERNAME!,
          password: process.env.ELASTIC_PASSWORD!,
        },
      },
      index: `${process.env.APP_NAME}-${process.env.APP_ENV}`,
      transform: (logData) => {
        return {
          '@timestamp': logData.timestamp,
          level: logData.level,
          message: logData.message,
          stack: logData.stack,
          context: logData.context || logData.metadata?.context,
          environment: logData.environment || process.env.APP_ENV,
          correlationId: logData.correlationId || this.correlationIdService.getCorrelationId(),
        };
      },
    };

    this.logger = createLogger({
      level: 'silly',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format((info) => {
          info.environment = process.env.APP_ENV;
          info.pid = process.pid;
          info.correlationId = this.correlationIdService.getCorrelationId() ?? 'N/A';
          return info;
        })(),
        format.metadata({
          fillExcept: [
            'message',
            'level',
            'timestamp',
            'label',
            'environment',
            'context',
            'correlationId',
          ],
        }),
        format.json(),
      ),

      transports: [
        ...(!this.isDev ? [new ElasticsearchTransport(esTransportOpts)] : []),
        new transports.Console({
          format: format.combine(
            format.colorize({ all: true }),
            format.timestamp({ format: 'DD/MM/YYYY H:mm:ss ' }),
            format.printf(
              ({
                level,
                message,
                timestamp,
                context,
                stack,
                metadata,
              }: {
                level: string;
                message: string;
                timestamp: string;
                context?: string;
                stack?: string;
                metadata: Record<string, any>;
                [key: string]: any;
              }) => {
                const pid = process.pid;
                const correlationId = this.correlationIdService.getCorrelationId();
                const ctx = context
                  ? `[${context}]`
                  : metadata.context
                    ? `[${metadata.context}]`
                    : '';
                const prefix = `PID: ${pid.toString().padStart(5)} | ${correlationId} | ${timestamp} ${level}`;
                const msg = stack ? `${message}\n${stack}` : message;
                return `${prefix} ${ctx} ${msg}`.trim();
              },
            ),
          ),
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(this.formatMessage(message), { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(this.formatMessage(message), { stack: trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(this.formatMessage(message), { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(this.formatMessage(message), { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(this.formatMessage(message), { context });
  }

  private formatMessage(message: any) {
    return typeof message === 'object' ? JSON.stringify(message) : message;
  }
}
