import { Test, TestingModule } from '@nestjs/testing';
import { EMBEDDING_PROVIDER } from '../embeddings/types/embedding-provider.interface';
import { SearchService } from './search.service';
import { VectorStoreService } from './vector-store.service';

describe('SearchService', () => {
  let service: SearchService;

  const embeddingProvider = {
    embed: jest.fn(),
    dimensions: 1536,
    model: 'test',
  };
  const vectorStoreService = { search: jest.fn() };

  const hit = {
    chunkId: 'chunk-1',
    score: 0.91,
    payload: {
      documentId: 'doc-1',
      filename: 'arquivo.docx',
      page: 2,
      chunkIndex: 3,
      text: 'trecho relevante',
      metadata: { origem: 'teste' },
      userId: 'user-1',
      agentId: 'agent-1',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: EMBEDDING_PROVIDER, useValue: embeddingProvider },
        { provide: VectorStoreService, useValue: vectorStoreService },
      ],
    }).compile();
    service = module.get(SearchService);
  });

  it('embeda a query e busca no vector store com filtros', async () => {
    embeddingProvider.embed.mockResolvedValueOnce([[0.1, 0.2]]);
    vectorStoreService.search.mockResolvedValueOnce([hit]);

    const result = await service.search({
      query: 'o que é autoralidade?',
      agentId: 'agent-1',
      userId: 'user-1',
      limit: 5,
    });

    expect(embeddingProvider.embed).toHaveBeenCalledWith([
      'o que é autoralidade?',
    ]);
    expect(vectorStoreService.search).toHaveBeenCalledWith([0.1, 0.2], {
      agentId: 'agent-1',
      userId: 'user-1',
      documentId: undefined,
      limit: 5,
    });
    expect(result.total).toBe(1);
    expect(result.results[0]).toEqual({
      chunkId: 'chunk-1',
      score: 0.91,
      documentId: 'doc-1',
      filename: 'arquivo.docx',
      page: 2,
      chunkIndex: 3,
      text: 'trecho relevante',
      metadata: { origem: 'teste' },
    });
  });

  it('filtra resultados abaixo do minScore', async () => {
    embeddingProvider.embed.mockResolvedValueOnce([[0.1]]);
    vectorStoreService.search.mockResolvedValueOnce([
      hit,
      { ...hit, chunkId: 'chunk-2', score: 0.4 },
    ]);

    const result = await service.search({
      query: 'q',
      agentId: 'agent-1',
      minScore: 0.5,
    });

    expect(result.total).toBe(1);
    expect(result.results[0].chunkId).toBe('chunk-1');
  });

  it('retorna vazio quando não há hits', async () => {
    embeddingProvider.embed.mockResolvedValueOnce([[0.1]]);
    vectorStoreService.search.mockResolvedValueOnce([]);

    const result = await service.search({ query: 'q', agentId: 'agent-1' });

    expect(result).toEqual({ results: [], total: 0 });
  });

  it('usa fallbacks para payload incompleto', async () => {
    embeddingProvider.embed.mockResolvedValueOnce([[0.1]]);
    vectorStoreService.search.mockResolvedValueOnce([
      { chunkId: 'chunk-3', score: 0.8, payload: {} },
    ]);

    const result = await service.search({ query: 'q', agentId: 'agent-1' });

    expect(result.results[0]).toEqual({
      chunkId: 'chunk-3',
      score: 0.8,
      documentId: '',
      filename: '',
      page: null,
      chunkIndex: 0,
      text: '',
      metadata: {},
    });
  });
});
