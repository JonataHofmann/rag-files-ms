import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { Observable } from 'rxjs';
import { CorrelationIdService } from '../services/correlation-id.service';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(private readonly correlationIdService: CorrelationIdService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const incomingId = req.headers[this.correlationIdService.headerName] as string | undefined;

    this.correlationIdService.setCorrelationId(incomingId);

    return next.handle();
  }
}
