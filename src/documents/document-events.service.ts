import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';

export interface DocumentStatusEvent {
  documentId: string;
  agentId: string;
  status: DocumentStatusEnum;
  error: string | null;
  chunkCount: number;
  pageCount: number | null;
}

@Injectable()
export class DocumentEventsService {
  private readonly subject = new Subject<DocumentStatusEvent>();

  emit(event: DocumentStatusEvent): void {
    this.subject.next(event);
  }

  stream(agentId?: string): Observable<DocumentStatusEvent> {
    return this.subject
      .asObservable()
      .pipe(filter((event) => !agentId || event.agentId === agentId));
  }
}
