import { validate } from 'class-validator';
import { SearchRequestDto } from './search.dto';

describe('SearchRequestDto', () => {
  const valid = () =>
    Object.assign(new SearchRequestDto(), {
      query: 'o que é autoralidade?',
      agentId: 'agent-1',
    });

  it('aceita payload mínimo válido', async () => {
    const errors = await validate(valid());
    expect(errors).toHaveLength(0);
  });

  it('rejeita query vazia', async () => {
    const dto = Object.assign(valid(), { query: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'query')).toBe(true);
  });

  it('rejeita agentId vazio', async () => {
    const dto = Object.assign(valid(), { agentId: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'agentId')).toBe(true);
  });

  it('aceita filtros opcionais válidos', async () => {
    const dto = Object.assign(valid(), {
      userId: 'user-1',
      documentId: 'doc-1',
      limit: 10,
      minScore: 0.5,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita limit fora do intervalo', async () => {
    const dto = Object.assign(valid(), { limit: 51 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejeita minScore acima de 1', async () => {
    const dto = Object.assign(valid(), { minScore: 1.5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'minScore')).toBe(true);
  });
});
