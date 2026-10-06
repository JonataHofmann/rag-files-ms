import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdService {
  private readonly key = 'correlationId';
  public readonly headerName = 'x-correlation-id';

  constructor(private readonly cls: ClsService) {}

  setCorrelationId(correlationId?: string) {
    this.cls.set(this.key, correlationId ?? uuidv4());
  }

  getCorrelationId(): string | undefined {
    return this.cls.get(this.key) ?? 'N/A';
  }
}
