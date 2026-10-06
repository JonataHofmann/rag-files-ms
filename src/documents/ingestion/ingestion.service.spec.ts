import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { EMBEDDING_PROVIDER } from '../../embeddings/types/embedding-provider.interface';
import { VectorStoreService } from '../../rag/vector-store.service';
import { DocumentEventsService } from '../document-events.service';
import { StorageService } from '../../storage/storage.service';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { DocumentEntity } from '../entities/document.entity';
import { TextExtractorService } from '../extraction/text-extractor.service';
import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  const documentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const agentId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const baseDocument = {
    id: documentId,
    userId: 'user-1',
    agentId,
    originalName: 'nota.txt',
    mimeType: 'text/plain',
    blobName: 'user-1/doc/nota.txt',
    metadata: {},
    chunkSize: 1000,
    chunkOverlap: 200,
  };

  const documentRepo = {
    findOneBy: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };
  const chunkRepo = {
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const storageService = { download: jest.fn() };
  const textExtractor = { extract: jest.fn() };
  const embeddingProvider = {
    embed: jest.fn(),
    dimensions: 1536,
    model: 'test',
  };
  const vectorStoreService = {
    deleteByDocumentId: jest.fn(),
    upsertChunks: jest.fn(),
  };

  let service: IngestionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // TypeORM sempre devolve UpdateResult; default = 1 linha afetada (sucesso).
    documentRepo.update.mockResolvedValue({ affected: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: documentRepo,
        },
        {
          provide: getRepositoryToken(DocumentChunk),
          useValue: chunkRepo,
        },
        { provide: StorageService, useValue: storageService },
        { provide: TextExtractorService, useValue: textExtractor },
        { provide: EMBEDDING_PROVIDER, useValue: embeddingProvider },
        { provide: VectorStoreService, useValue: vectorStoreService },
        {
          provide: DocumentEventsService,
          useValue: { emit: jest.fn(), stream: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(IngestionService);
  });

  it('fluxo feliz: doc processing -> processed com chunks indexados', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(baseDocument);
    storageService.download.mockResolvedValueOnce(Buffer.from('arquivo'));
    textExtractor.extract.mockResolvedValueOnce([
      { page: 1, text: 'Texto do documento.' },
    ]);
    embeddingProvider.embed.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => [0.1, 0.2])),
    );
    chunkRepo.create.mockImplementation((data) => data);
    chunkRepo.save.mockResolvedValueOnce([]);

    await service.process(documentId);

    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      { status: DocumentStatusEnum.Processing, error: null },
    );
    expect(chunkRepo.delete).toHaveBeenCalledWith({ documentId });
    expect(vectorStoreService.deleteByDocumentId).toHaveBeenCalledWith(
      documentId,
    );
    expect(chunkRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        agentId,
        chunkIndex: 0,
        page: 1,
        text: 'Texto do documento.',
      }),
    ]);
    expect(vectorStoreService.upsertChunks).toHaveBeenCalledWith([
      expect.objectContaining({
        vector: [0.1, 0.2],
        payload: expect.objectContaining({
          documentId,
          agentId,
          filename: 'nota.txt',
          userId: 'user-1',
          text: 'Texto do documento.',
        }),
      }),
    ]);
    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      expect.objectContaining({
        status: DocumentStatusEnum.Processed,
        chunkCount: 1,
      }),
    );
  });

  it('removido durante o processamento (update affected 0): descarta chunks/vetores', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(baseDocument);
    storageService.download.mockResolvedValueOnce(Buffer.from('arquivo'));
    textExtractor.extract.mockResolvedValueOnce([
      { page: 1, text: 'Texto do documento.' },
    ]);
    embeddingProvider.embed.mockResolvedValue([[0.1, 0.2]]);
    chunkRepo.create.mockImplementation((data) => data);
    chunkRepo.save.mockResolvedValueOnce([]);
    // update final não afeta linhas → documento foi deletado no meio.
    documentRepo.update
      .mockResolvedValueOnce({ affected: 1 }) // status Processing (início)
      .mockResolvedValueOnce({ affected: 0 }); // status Processed (doc já removido)

    await service.process(documentId);

    // pré-limpeza (1x) + rollback (1x) = 2 chamadas em cada.
    expect(chunkRepo.delete).toHaveBeenCalledTimes(2);
    expect(vectorStoreService.deleteByDocumentId).toHaveBeenCalledTimes(2);
    expect(documentRepo.update).not.toHaveBeenCalledWith(
      { id: documentId },
      expect.objectContaining({ status: DocumentStatusEnum.Failed }),
    );
  });

  it('processa documento com metadata nulo e paginas sem numero', async () => {
    const docSemMetadata = {
      ...baseDocument,
      metadata: null as unknown as Record<string, unknown>,
    };
    documentRepo.findOneBy.mockResolvedValueOnce(docSemMetadata);
    storageService.download.mockResolvedValueOnce(Buffer.from('texto'));
    textExtractor.extract.mockResolvedValueOnce([
      { page: null, text: 'sem numero' },
    ]);
    embeddingProvider.embed.mockResolvedValue([[0.1]]);
    chunkRepo.create.mockImplementation((data) => data);
    chunkRepo.save.mockResolvedValueOnce([]);

    await service.process(documentId);

    expect(vectorStoreService.upsertChunks).toHaveBeenCalledWith([
      expect.objectContaining({
        payload: expect.objectContaining({ metadata: {} }),
      }),
    ]);
    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      expect.objectContaining({ pageCount: null }),
    );
  });

  it('falha na extração: documento failed com a mensagem de erro', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(baseDocument);
    storageService.download.mockRejectedValueOnce(
      new Error('blob indisponível'),
    );

    await service.process(documentId);

    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      { status: DocumentStatusEnum.Failed, error: 'blob indisponível' },
    );
    expect(vectorStoreService.upsertChunks).not.toHaveBeenCalled();
  });

  it('erro sem .message usa fallback', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(baseDocument);
    storageService.download.mockRejectedValueOnce({});

    await service.process(documentId);

    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      {
        status: DocumentStatusEnum.Failed,
        error: 'Erro desconhecido na ingestão',
      },
    );
  });

  it('documento sem texto extraível marca falha', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(baseDocument);
    storageService.download.mockResolvedValueOnce(Buffer.from(''));
    textExtractor.extract.mockResolvedValueOnce([]);

    await service.process(documentId);

    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      {
        status: DocumentStatusEnum.Failed,
        error: 'Nenhum texto extraído do documento',
      },
    );
  });

  it('documento inexistente é ignorado sem efeitos colaterais', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(null);

    await service.process('doc-x');

    expect(documentRepo.update).not.toHaveBeenCalled();
    expect(storageService.download).not.toHaveBeenCalled();
  });

  it('chunking vazio durante process marca falha', async () => {
    documentRepo.findOneBy.mockResolvedValueOnce(baseDocument);
    storageService.download.mockResolvedValueOnce(Buffer.from('texto'));
    textExtractor.extract.mockResolvedValueOnce([{ page: null, text: 'a' }]);
    (service as any).chunker = { chunk: jest.fn().mockResolvedValue([]) };

    await service.process(documentId);

    expect(documentRepo.update).toHaveBeenCalledWith(
      { id: documentId },
      expect.objectContaining({
        status: DocumentStatusEnum.Failed,
        error: expect.stringContaining('Chunking'),
      }),
    );
  });

  describe('failInterrupted', () => {
    it('marca documentos processing como failed', async () => {
      documentRepo.update.mockResolvedValueOnce({ affected: 2 });

      const result = await service.failInterrupted();

      expect(documentRepo.update).toHaveBeenCalledWith(
        { status: DocumentStatusEnum.Processing },
        expect.objectContaining({ status: DocumentStatusEnum.Failed }),
      );
      expect(result).toBe(2);
    });

    it('retorna 0 quando affected undefined', async () => {
      documentRepo.update.mockResolvedValueOnce({ affected: undefined });

      const result = await service.failInterrupted();

      expect(result).toBe(0);
    });
  });

  describe('findPendingDocumentIds', () => {
    it('retorna ids de documentos uploaded', async () => {
      documentRepo.find.mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]);

      const result = await service.findPendingDocumentIds();

      expect(documentRepo.find).toHaveBeenCalledWith({
        where: { status: DocumentStatusEnum.Uploaded },
        select: { id: true },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(['d1', 'd2']);
    });
  });

  describe('ingestBlob', () => {
    it('extrai, chunk, embed e upsert com valores default', async () => {
      storageService.download.mockResolvedValueOnce(Buffer.from('texto'));
      textExtractor.extract.mockResolvedValueOnce([
        { page: 1, text: 'paragrafo um' },
        { page: 2, text: 'paragrafo dois' },
      ]);
      embeddingProvider.embed.mockResolvedValue([[0.1], [0.2]]);

      const result = await service.ingestBlob(
        'user/blob.txt',
        'arquivo.txt',
        'text/plain',
        { userId: 'u1', agentId: 'a1' },
      );

      expect(result.chunks).toHaveLength(2);
      expect(result.chunkIds).toHaveLength(2);
      expect(result.vectors).toHaveLength(2);
      expect(result.pages).toHaveLength(2);
      expect(vectorStoreService.upsertChunks).toHaveBeenCalledTimes(1);
    });

    it('usa chunkSize e chunkOverlap customizados', async () => {
      storageService.download.mockResolvedValueOnce(Buffer.from('texto'));
      textExtractor.extract.mockResolvedValueOnce([
        { page: null, text: 'abc' },
      ]);
      embeddingProvider.embed.mockResolvedValue([[0.1]]);

      const result = await service.ingestBlob(
        'user/blob.txt',
        'arquivo.txt',
        'text/plain',
        { userId: 'u1', agentId: 'a1' },
        500,
        100,
      );

      expect(result.chunks).toHaveLength(1);
    });

    it('lança erro quando extração retorna vazio', async () => {
      storageService.download.mockResolvedValueOnce(Buffer.from(''));
      textExtractor.extract.mockResolvedValueOnce([]);

      await expect(
        service.ingestBlob('blob', 'f.txt', 'text/plain', {
          userId: 'u1',
          agentId: 'a1',
        }),
      ).rejects.toThrow('Nenhum texto extraído');
    });

    it('lança erro quando chunking retorna vazio', async () => {
      storageService.download.mockResolvedValueOnce(Buffer.from('texto'));
      textExtractor.extract.mockResolvedValueOnce([{ page: null, text: 'a' }]);
      (service as any).chunker = { chunk: jest.fn().mockResolvedValue([]) };

      await expect(
        service.ingestBlob('blob', 'f.txt', 'text/plain', {
          userId: 'u1',
          agentId: 'a1',
        }),
      ).rejects.toThrow('Chunking não produziu');
    });
  });
});
