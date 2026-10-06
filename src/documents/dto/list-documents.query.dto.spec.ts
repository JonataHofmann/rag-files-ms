import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListDocumentsQueryDto } from './list-documents.query.dto';

describe('ListDocumentsQueryDto', () => {
  const base = { userId: 'system' };

  it('aceita valores padrão com userId', async () => {
    const dto = Object.assign(new ListDocumentsQueryDto(), base);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita userId ausente', async () => {
    const dto = new ListDocumentsQueryDto();
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('rejeita userId vazio', async () => {
    const dto = Object.assign(new ListDocumentsQueryDto(), { userId: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('valida page e limit como inteiros positivos', async () => {
    const dto = Object.assign(new ListDocumentsQueryDto(), {
      ...base,
      page: 0,
      limit: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('transforma page e limit de string para número', async () => {
    const dto = plainToInstance(ListDocumentsQueryDto, {
      ...base,
      page: '3',
      limit: '15',
    });
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(15);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('valida status enum', async () => {
    const dto = Object.assign(new ListDocumentsQueryDto(), {
      ...base,
      status: 'invalido',
    });
    const errors = await validate(dto);
    const statusErrors = errors.filter((e) => e.property === 'status');
    expect(statusErrors.length).toBeGreaterThan(0);
  });
});
