import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChunkEmbedding } from './entities/chunk-embedding.entity';
import { VectorStoreService } from './vector-store.service';

describe('VectorStoreService', () => {
  let service: VectorStoreService;

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  const embeddingRepo = {
    find: jest.fn(),
    create: jest.fn((data: unknown): unknown => data),
    upsert: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const point = {
    id: 'chunk-1',
    vector: [0.1, 0.2],
    payload: {
      documentId: 'doc-1',
      agentId: 'agent-1',
      userId: 'user-1',
      text: 'texto',
    },
  };

  const makeReady = async () => {
    embeddingRepo.find.mockResolvedValueOnce([]);
    await service.onModuleInit();
    jest.clearAllMocks();
    embeddingRepo.create.mockImplementation((data: unknown): unknown => data);
    embeddingRepo.createQueryBuilder.mockReturnValue(queryBuilder);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    embeddingRepo.create.mockImplementation((data: unknown): unknown => data);
    embeddingRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorStoreService,
        {
          provide: getRepositoryToken(ChunkEmbedding),
          useValue: embeddingRepo,
        },
      ],
    }).compile();
    service = module.get(VectorStoreService);
  });

  describe('onModuleInit', () => {
    it('verifica tabela e fica ready', async () => {
      embeddingRepo.find.mockResolvedValueOnce([]);

      await service.onModuleInit();

      expect(embeddingRepo.find).toHaveBeenCalledWith({ take: 1 });
      expect(service.isReady()).toBe(true);
    });

    it('quando tabela ausente, não fica ready e não propaga erro', async () => {
      embeddingRepo.find.mockRejectedValueOnce(
        new Error('relation "chunk_embeddings" does not exist'),
      );

      await service.onModuleInit();

      expect(service.isReady()).toBe(false);
    });
  });

  describe('upsertChunks', () => {
    it('lança erro quando store não inicializado', async () => {
      await expect(service.upsertChunks([point])).rejects.toThrow('pgvector');
    });

    it('faz upsert por chunkId com entidade mapeada', async () => {
      await makeReady();

      await service.upsertChunks([point]);

      expect(embeddingRepo.upsert).toHaveBeenCalledTimes(1);
      const [entities, conflictPaths] = embeddingRepo.upsert.mock.calls[0] as [
        Array<Record<string, unknown>>,
        string[],
      ];
      expect(conflictPaths).toEqual(['chunkId']);
      expect(entities[0]).toEqual({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        agentId: 'agent-1',
        userId: 'user-1',
        threadId: (point.payload as Record<string, unknown>).threadId ?? null,
        embedding: [0.1, 0.2],
        payload: point.payload,
      });
    });

    it('usa null quando payload não tem userId', async () => {
      await makeReady();

      await service.upsertChunks([
        {
          ...point,
          payload: { documentId: 'doc-1', agentId: 'agent-1' },
        },
      ]);

      const [entities] = embeddingRepo.upsert.mock.calls[0] as [
        Array<Record<string, unknown>>,
      ];
      expect(entities[0].userId).toBeNull();
    });

    it('divide em lotes de 100', async () => {
      await makeReady();
      const points = Array.from({ length: 150 }, (_, i) => ({
        ...point,
        id: `chunk-${i}`,
      }));

      await service.upsertChunks(points);

      expect(embeddingRepo.upsert).toHaveBeenCalledTimes(2);
    });

    it('não faz upsert com lista vazia', async () => {
      await makeReady();

      await service.upsertChunks([]);

      expect(embeddingRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('lança erro quando não ready', async () => {
      await expect(service.search([0.1])).rejects.toThrow('pgvector');
    });

    it('busca por similaridade com filtros', async () => {
      await makeReady();
      queryBuilder.getRawMany.mockResolvedValueOnce([
        { chunkId: 'chunk-1', score: '0.93', payload: { text: 'texto' } },
      ]);

      const results = await service.search([0.1, 0.2], {
        agentId: 'agent-1',
        userId: 'user-1',
        limit: 5,
      });

      expect(queryBuilder.setParameter).toHaveBeenCalledWith(
        'qvector',
        '[0.1,0.2]',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'ce.embedding <=> :qvector::vector',
        'ASC',
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'ce.agentId = :agentId',
        { agentId: 'agent-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'ce.userId = :userId',
        { userId: 'user-1' },
      );
      expect(queryBuilder.limit).toHaveBeenCalledWith(5);
      expect(results).toEqual([
        { chunkId: 'chunk-1', score: 0.93, payload: { text: 'texto' } },
      ]);
    });

    it('aplica filtro documentId', async () => {
      await makeReady();
      queryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.search([0.1], { documentId: 'doc-1' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'ce.documentId = :documentId',
        { documentId: 'doc-1' },
      );
    });

    it('usa limit default 8 sem filtros', async () => {
      await makeReady();
      queryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.search([0.1]);

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(queryBuilder.limit).toHaveBeenCalledWith(8);
    });
  });

  describe('deletes', () => {
    it('deleteByDocumentId ignora quando não ready', async () => {
      await service.deleteByDocumentId('doc-1');

      expect(embeddingRepo.delete).not.toHaveBeenCalled();
    });

    it('deleteByAgentId ignora quando não ready', async () => {
      await service.deleteByAgentId('agent-1');

      expect(embeddingRepo.delete).not.toHaveBeenCalled();
    });

    it('deleteByDocumentId remove vetores do documento', async () => {
      await makeReady();

      await service.deleteByDocumentId('doc-1');

      expect(embeddingRepo.delete).toHaveBeenCalledWith({
        documentId: 'doc-1',
      });
    });

    it('deleteByAgentId remove vetores do agente', async () => {
      await makeReady();

      await service.deleteByAgentId('agent-1');

      expect(embeddingRepo.delete).toHaveBeenCalledWith({
        agentId: 'agent-1',
      });
    });
  });
});
