import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { ServiceBusIngestionQueue } from './service-bus-ingestion.queue';

const mockSender = {
  sendMessages: jest.fn(),
  close: jest.fn(),
};
const mockReceiver = {
  subscribe: jest.fn(),
  completeMessage: jest.fn(),
  abandonMessage: jest.fn(),
  deadLetterMessage: jest.fn(),
  close: jest.fn(),
};
const mockClient = {
  createSender: jest.fn(() => mockSender),
  createReceiver: jest.fn(() => mockReceiver),
  close: jest.fn(),
};

jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn(() => mockClient),
}));

describe('ServiceBusIngestionQueue', () => {
  let queue: ServiceBusIngestionQueue;
  let ingestionService: jest.Mocked<IngestionService>;

  const flushPromises = () => new Promise(process.nextTick);

  const getHandlers = () => {
    const [handlers] = mockReceiver.subscribe.mock.calls[0];
    return handlers as {
      processMessage: (message: unknown) => Promise<void>;
      processError: (args: unknown) => Promise<void>;
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ingestionService = {
      process: jest.fn(),
      failInterrupted: jest.fn().mockResolvedValue(0),
    } as any;

    const configService = {
      get: jest.fn((key: string, fallback: string) => {
        if (key === 'AZURE_SERVICE_BUS_CONNECTION_STRING') {
          return 'Endpoint=sb://test/;SharedAccessKeyName=x;SharedAccessKey=y';
        }
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceBusIngestionQueue,
        { provide: IngestionService, useValue: ingestionService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    queue = module.get(ServiceBusIngestionQueue);
  });

  describe('enqueue', () => {
    it('envia mensagem com documentId para a fila', async () => {
      mockSender.sendMessages.mockResolvedValueOnce(undefined);

      queue.enqueue('doc-1');
      await flushPromises();

      expect(mockSender.sendMessages).toHaveBeenCalledWith({
        body: { documentId: 'doc-1' },
      });
    });

    it('não propaga erro de envio', async () => {
      mockSender.sendMessages.mockRejectedValueOnce(new Error('sb down'));

      expect(() => queue.enqueue('doc-1')).not.toThrow();
      await flushPromises();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('marca documentos interrompidos e inicia subscribe com peekLock', async () => {
      ingestionService.failInterrupted.mockResolvedValue(2);

      await queue.onApplicationBootstrap();

      expect(ingestionService.failInterrupted).toHaveBeenCalledTimes(1);
      expect(mockReceiver.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          processMessage: expect.any(Function),
          processError: expect.any(Function),
        }),
        expect.objectContaining({
          maxConcurrentCalls: 1,
          autoCompleteMessages: false,
        }),
      );
    });
  });

  describe('processMessage', () => {
    it('processa documento e completa mensagem', async () => {
      ingestionService.process.mockResolvedValueOnce(undefined);
      await queue.onApplicationBootstrap();
      const message = { body: { documentId: 'doc-1' } };

      await getHandlers().processMessage(message);

      expect(ingestionService.process).toHaveBeenCalledWith('doc-1');
      expect(mockReceiver.completeMessage).toHaveBeenCalledWith(message);
      expect(mockReceiver.abandonMessage).not.toHaveBeenCalled();
    });

    it('abandona mensagem quando processamento falha', async () => {
      ingestionService.process.mockRejectedValueOnce(new Error('boom'));
      await queue.onApplicationBootstrap();
      const message = { body: { documentId: 'doc-1' } };

      await getHandlers().processMessage(message);

      expect(mockReceiver.abandonMessage).toHaveBeenCalledWith(message);
      expect(mockReceiver.completeMessage).not.toHaveBeenCalled();
    });

    it('envia mensagem sem documentId para dead-letter', async () => {
      await queue.onApplicationBootstrap();
      const message = { body: {} };

      await getHandlers().processMessage(message);

      expect(mockReceiver.deadLetterMessage).toHaveBeenCalledWith(
        message,
        expect.objectContaining({ deadLetterReason: 'InvalidPayload' }),
      );
      expect(ingestionService.process).not.toHaveBeenCalled();
    });
  });

  describe('processError', () => {
    it('loga erro do receiver sem propagar', async () => {
      await queue.onApplicationBootstrap();
      const [handlers] = mockReceiver.subscribe.mock.calls[0] as [
        { processError: (args: unknown) => Promise<void> },
      ];

      await expect(
        handlers.processError({
          errorSource: 'receive',
          error: new Error('conexão caiu'),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('onApplicationShutdown', () => {
    it('fecha receiver, sender e client', async () => {
      await queue.onApplicationShutdown();

      expect(mockReceiver.close).toHaveBeenCalledTimes(1);
      expect(mockSender.close).toHaveBeenCalledTimes(1);
      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });
  });
});
