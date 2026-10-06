import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import {
  DocumentEventsService,
  DocumentStatusEvent,
} from './document-events.service';

describe('DocumentEventsService', () => {
  let service: DocumentEventsService;

  const makeEvent = (
    overrides: Partial<DocumentStatusEvent> = {},
  ): DocumentStatusEvent => ({
    documentId: 'doc-1',
    agentId: 'agent-1',
    status: DocumentStatusEnum.Processing,
    error: null,
    chunkCount: 0,
    pageCount: null,
    ...overrides,
  });

  beforeEach(() => {
    service = new DocumentEventsService();
  });

  it('entrega evento emitido aos assinantes', () => {
    const received: DocumentStatusEvent[] = [];
    const subscription = service.stream().subscribe((e) => received.push(e));

    const event = makeEvent();
    service.emit(event);

    expect(received).toEqual([event]);
    subscription.unsubscribe();
  });

  it('filtra por agentId quando fornecido', () => {
    const received: DocumentStatusEvent[] = [];
    const subscription = service
      .stream('agent-1')
      .subscribe((e) => received.push(e));

    service.emit(makeEvent({ agentId: 'agent-1' }));
    service.emit(makeEvent({ agentId: 'agent-2', documentId: 'doc-2' }));

    expect(received).toHaveLength(1);
    expect(received[0].agentId).toBe('agent-1');
    subscription.unsubscribe();
  });

  it('sem agentId recebe eventos de todos os agentes', () => {
    const received: DocumentStatusEvent[] = [];
    const subscription = service.stream().subscribe((e) => received.push(e));

    service.emit(makeEvent({ agentId: 'agent-1' }));
    service.emit(makeEvent({ agentId: 'agent-2', documentId: 'doc-2' }));

    expect(received).toHaveLength(2);
    subscription.unsubscribe();
  });
});
