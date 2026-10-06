import { parseHtml } from './html.parser';

jest.mock('html-to-text', () => ({
  convert: jest.fn((html: string) => `converted: ${html}`),
}));

describe('parseHtml', () => {
  it('extrai texto de HTML simples', () => {
    const buffer = Buffer.from('<p>Hello</p>');
    const result = parseHtml(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].page).toBeNull();
    expect(result[0].text).toBe('converted: <p>Hello</p>');
  });

  it('processa HTML vazio', () => {
    const buffer = Buffer.from('');
    const result = parseHtml(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('converted: ');
  });
});
