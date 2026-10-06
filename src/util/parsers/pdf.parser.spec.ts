import { parsePdf } from './pdf.parser';

const mockGetInfo = jest.fn();
const mockGetText = jest.fn();
const mockDestroy = jest.fn();

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getInfo: mockGetInfo,
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

describe('parsePdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extrai texto página por página com numeração', async () => {
    mockGetInfo.mockResolvedValue({ pages: 3 });
    mockGetText
      .mockResolvedValueOnce('page 1 text')
      .mockResolvedValueOnce('page 2 text')
      .mockResolvedValueOnce('page 3 text');

    const result = await parsePdf(Buffer.from('fake-pdf'));

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ page: 1, text: 'page 1 text' });
    expect(result[1]).toEqual({ page: 2, text: 'page 2 text' });
    expect(result[2]).toEqual({ page: 3, text: 'page 3 text' });
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('lida com getText retornando objeto com .text', async () => {
    mockGetInfo.mockResolvedValue({ pages: 2 });
    mockGetText
      .mockResolvedValueOnce({ text: 'obj page 1' })
      .mockResolvedValueOnce({ text: 'obj page 2' });

    const result = await parsePdf(Buffer.from('fake-pdf'));

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('obj page 1');
    expect(result[1].text).toBe('obj page 2');
  });

  it('lida com getText retornando null/undefined', async () => {
    mockGetInfo.mockResolvedValue({ pages: 1 });
    mockGetText.mockResolvedValueOnce(null);

    const result = await parsePdf(Buffer.from('fake-pdf'));

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('');
  });

  it('lida com getText retornando objeto com text null', async () => {
    mockGetInfo.mockResolvedValue({ pages: 1 });
    mockGetText.mockResolvedValueOnce({ text: null });

    const result = await parsePdf(Buffer.from('fake-pdf'));

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('');
  });

  it('lança erro quando PDF é inválido', async () => {
    mockGetInfo.mockRejectedValue(new Error('corrupted file'));

    await expect(parsePdf(Buffer.from('bad-pdf'))).rejects.toThrow(
      'Falha ao processar PDF: corrupted file',
    );
  });

  it('lança erro genérico quando erro não tem message', async () => {
    mockGetInfo.mockRejectedValue(42);

    await expect(parsePdf(Buffer.from('bad-pdf'))).rejects.toThrow(
      'Falha ao processar PDF: arquivo inválido ou corrompido',
    );
  });
});
