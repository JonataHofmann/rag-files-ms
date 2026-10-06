import { Test, TestingModule } from '@nestjs/testing';
import { InProcessIngestionQueue } from './ingestion.queue';
import { IngestionService } from './ingestion.service';

describe('InProcessIngestionQueue', () => {
  let queue: InProcessIngestionQueue;
  let ingestionService: jest.Mocked<IngestionService>;

  beforeEach(async () => {
    ingestionService = {
      process: jest.fn(),
      failInterrupted: jest.fn(),
      findPendingDocumentIds: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InProcessIngestionQueue,
        { provide: IngestionService, useValue: ingestionService },
      ],
    }).compile();

    queue = module.get(InProcessIngestionQueue);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('adiciona documento à fila e processa', async () => {
      ingestionService.process.mockResolvedValueOnce(undefined);

      await queue.enqueue('doc-1');

      expect(ingestionService.process).toHaveBeenCalledWith('doc-1');
    });

    it('processa múltiplos documentos em sequência', async () => {
      ingestionService.process.mockResolvedValue(undefined);

      await queue.enqueue('doc-1');
      await queue.enqueue('doc-2');

      expect(ingestionService.process).toHaveBeenCalledTimes(2);
      expect(ingestionService.process).toHaveBeenNthCalledWith(1, 'doc-1');
      expect(ingestionService.process).toHaveBeenNthCalledWith(2, 'doc-2');
    });
  });

  describe('onApplicationBootstrap', () => {
    it('marca documentos interrompidos como failed e reenfileira pendentes', async () => {
      ingestionService.failInterrupted.mockResolvedValue(2);
      ingestionService.findPendingDocumentIds.mockResolvedValue([
        'pending-1',
        'pending-2',
      ]);
      ingestionService.process.mockResolvedValue(undefined);

      await queue.onApplicationBootstrap();

      expect(ingestionService.failInterrupted).toHaveBeenCalledTimes(1);
      expect(ingestionService.findPendingDocumentIds).toHaveBeenCalledTimes(1);
      expect(ingestionService.process).toHaveBeenCalledTimes(2);
      expect(ingestionService.process).toHaveBeenCalledWith('pending-1');
      expect(ingestionService.process).toHaveBeenCalledWith('pending-2');
    });

    it('quando nenhum documento interrompido, ainda reenfileira pendentes', async () => {
      ingestionService.failInterrupted.mockResolvedValue(0);
      ingestionService.findPendingDocumentIds.mockResolvedValue([]);
      ingestionService.process.mockResolvedValue(undefined);

      await queue.onApplicationBootstrap();

      expect(ingestionService.failInterrupted).toHaveBeenCalledTimes(1);
      expect(ingestionService.findPendingDocumentIds).toHaveBeenCalledTimes(1);
      expect(ingestionService.process).not.toHaveBeenCalled();
    });
  });

  describe('drain (error handling)', () => {
    it('trata erro de processamento sem quebrar a fila', async () => {
      ingestionService.process
        .mockRejectedValueOnce(new Error('falha no documento'))
        .mockResolvedValueOnce(undefined);

      await queue.enqueue('doc-fail');
      await queue.enqueue('doc-ok');

      expect(ingestionService.process).toHaveBeenCalledTimes(2);
    });
  });
});
