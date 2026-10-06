import { parse } from 'csv-parse/sync';

jest.mock('csv-parse/sync', () => ({
  parse: jest.fn(),
}));

import { parseCsv } from './csv.parser';

describe('parseCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('converte CSV normal em texto com quebras por linha', () => {
    (parse as jest.Mock).mockReturnValue([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);

    const result = parseCsv(Buffer.from('name,age\nAlice,30\nBob,25'));

    expect(result).toHaveLength(1);
    expect(result[0].page).toBeNull();
    expect(result[0].text).toContain('Linha 1');
    expect(result[0].text).toContain('name: Alice');
    expect(result[0].text).toContain('age: 30');
  });

  it('retorna raw quando CSV vazio (apenas cabeçalho)', () => {
    (parse as jest.Mock).mockReturnValue([]);

    const result = parseCsv(Buffer.from('name,age\n'));

    expect(result).toHaveLength(1);
    expect(result[0].text).toContain('name,age');
  });

  it('retorna raw quando CSV não parseável (parse lança exceção)', () => {
    (parse as jest.Mock).mockImplementation(() => {
      throw new Error('CSV inválido');
    });

    const result = parseCsv(Buffer.from('not valid csv'));

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('not valid csv');
  });

  it('retorna raw para buffer vazio', () => {
    (parse as jest.Mock).mockReturnValue([]);

    const result = parseCsv(Buffer.from(''));

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('');
  });
});
