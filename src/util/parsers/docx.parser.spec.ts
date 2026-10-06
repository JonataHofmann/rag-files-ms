import { parseDocx } from './docx.parser';

const mockExtractRawText = jest.fn();

jest.mock('mammoth', () => ({
  extractRawText: (...args: any[]) => mockExtractRawText(...args),
}));

describe('parseDocx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extrai texto de buffer docx', async () => {
    mockExtractRawText.mockResolvedValue({ value: 'docx content' });

    const result = await parseDocx(Buffer.from('fake-docx'));

    expect(mockExtractRawText).toHaveBeenCalledWith({
      buffer: Buffer.from('fake-docx'),
    });
    expect(result).toEqual([{ page: null, text: 'docx content' }]);
  });

  it('retorna texto vazio quando docx não tem conteúdo', async () => {
    mockExtractRawText.mockResolvedValue({ value: '' });

    const result = await parseDocx(Buffer.from('empty-docx'));

    expect(result).toEqual([{ page: null, text: '' }]);
  });
});
