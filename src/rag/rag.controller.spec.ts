import { Test, TestingModule } from '@nestjs/testing';
import { RagController } from './rag.controller';
import { SearchService } from './search.service';

describe('RagController', () => {
  let controller: RagController;
  const searchService = { search: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagController],
      providers: [{ provide: SearchService, useValue: searchService }],
    }).compile();
    controller = module.get(RagController);
  });

  it('search delega para o service e retorna resultados', async () => {
    const dto = { query: 'autoralidade', agentId: 'agent-1' };
    const expected = {
      results: [
        {
          chunkId: 'c1',
          score: 0.9,
          documentId: 'doc-1',
          filename: 'f.docx',
          page: 1,
          chunkIndex: 0,
          text: 'trecho',
          metadata: {},
        },
      ],
      total: 1,
    };
    searchService.search.mockResolvedValueOnce(expected);

    const result = await controller.search(dto);

    expect(searchService.search).toHaveBeenCalledWith(dto);
    expect(result).toEqual(expected);
  });
});
