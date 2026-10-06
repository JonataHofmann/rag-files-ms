import { parsePlainText, parseJson } from './plain.parser';

describe('parsePlainText', () => {
  it('converte buffer em texto', () => {
    const result = parsePlainText(Buffer.from('hello world'));
    expect(result).toEqual([{ page: null, text: 'hello world' }]);
  });

  it('retorna string vazia para buffer vazio', () => {
    const result = parsePlainText(Buffer.from(''));
    expect(result).toEqual([{ page: null, text: '' }]);
  });

  it('decodifica UTF-8 corretamente', () => {
    const result = parsePlainText(Buffer.from('café'));
    expect(result[0].text).toBe('café');
  });
});

describe('parseJson', () => {
  it('converte JSON válido em string pretty-printed', () => {
    const result = parseJson(Buffer.from('{"a":1,"b":"hello"}'));
    expect(result).toHaveLength(1);
    expect(result[0].page).toBeNull();
    const parsed = JSON.parse(result[0].text);
    expect(parsed).toEqual({ a: 1, b: 'hello' });
    expect(result[0].text).toContain('\n');
  });

  it('retorna raw quando JSON inválido', () => {
    const result = parseJson(Buffer.from('not json'));
    expect(result).toEqual([{ page: null, text: 'not json' }]);
  });

  it('retorna raw para buffer vazio', () => {
    const result = parseJson(Buffer.from(''));
    expect(result).toEqual([{ page: null, text: '' }]);
  });
});
