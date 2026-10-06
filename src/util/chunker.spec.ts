import { Chunker } from './chunker';

describe('Chunker', () => {
  let chunker: Chunker;

  beforeEach(() => {
    chunker = new Chunker();
  });

  describe('chunk', () => {
    it('lança erro quando chunkOverlap >= chunkSize', async () => {
      await expect(
        chunker.chunk([{ page: null, text: 'texto' }], {
          chunkSize: 100,
          chunkOverlap: 100,
        }),
      ).rejects.toThrow('chunkOverlap deve ser menor que chunkSize');

      await expect(
        chunker.chunk([{ page: null, text: 'texto' }], {
          chunkSize: 100,
          chunkOverlap: 200,
        }),
      ).rejects.toThrow('chunkOverlap deve ser menor que chunkSize');
    });

    it('retorna chunks para texto simples', async () => {
      const result = await chunker.chunk(
        [{ page: null, text: 'Hello World' }],
        { chunkSize: 1000, chunkOverlap: 200 },
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        text: 'Hello World',
        index: 0,
        page: null,
      });
    });

    it('preserva referência de página', async () => {
      const result = await chunker.chunk(
        [
          { page: 1, text: 'Page one content.' },
          { page: 2, text: 'Page two content.' },
        ],
        { chunkSize: 1000, chunkOverlap: 200 },
      );

      expect(result).toHaveLength(2);
      expect(result[0].page).toBe(1);
      expect(result[1].page).toBe(2);
      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(1);
    });

    it('pula páginas com texto vazio após trim', async () => {
      const result = await chunker.chunk(
        [
          { page: 1, text: 'Content' },
          { page: 2, text: '   ' },
          { page: 3, text: 'More content' },
        ],
        { chunkSize: 1000, chunkOverlap: 200 },
      );

      expect(result).toHaveLength(2);
      expect(result[0].page).toBe(1);
      expect(result[1].page).toBe(3);
      expect(result[1].index).toBe(1);
    });

    it('quebra texto longo em múltiplos chunks com índices globais', async () => {
      const longText = 'A'.repeat(500) + ' ' + 'B'.repeat(500);
      const result = await chunker.chunk([{ page: 1, text: longText }], {
        chunkSize: 200,
        chunkOverlap: 0,
      });

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].index).toBe(0);
      expect(result[result.length - 1].index).toBe(result.length - 1);
      expect(result.every((c) => c.page === 1)).toBe(true);
    });

    it('aceita separadores customizados', async () => {
      const result = await chunker.chunk([{ page: null, text: 'a\nb\nc\nd' }], {
        chunkSize: 3,
        chunkOverlap: 0,
        separators: ['\n'],
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('não usa separadores customizados se não fornecidos', async () => {
      const result = await chunker.chunk([{ page: null, text: 'hello' }], {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      expect(result).toHaveLength(1);
    });
  });
});
