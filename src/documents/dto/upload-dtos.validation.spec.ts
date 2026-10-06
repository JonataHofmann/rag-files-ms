import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';
import { ConfirmUploadBatchDto } from './confirm-upload-batch.dto';
import { ConfirmUploadDto } from './confirm-upload.dto';
import { InitUploadBatchDto } from './init-upload-batch.dto';
import { InitUploadDto } from './init-upload.dto';

const validInit = {
  originalName: 'doc.txt',
  mimeType: 'text/plain',
  size: 100,
  agentId: 'agent-1',
  type: FileTypeEnum.SYSTEM,
  userId: 'system',
};

const validConfirm = {
  blobName: 'blob/doc.txt',
  originalName: 'doc.txt',
  mimeType: 'text/plain',
  size: '100',
  agentId: 'agent-1',
  type: FileTypeEnum.SYSTEM,
  userId: 'system',
};

describe('InitUploadDto', () => {
  it('aceita type system sem threadId/messageId', async () => {
    const dto = plainToInstance(InitUploadDto, validInit);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita userId ausente', async () => {
    const { userId: _userId, ...rest } = validInit;
    const dto = plainToInstance(InitUploadDto, rest);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('rejeita userId vazio', async () => {
    const dto = plainToInstance(InitUploadDto, { ...validInit, userId: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('exige threadId e messageId quando type é user', async () => {
    const dto = plainToInstance(InitUploadDto, {
      ...validInit,
      type: FileTypeEnum.USER,
    });
    const errors = await validate(dto);
    const properties = errors.map((e) => e.property);
    expect(properties).toEqual(
      expect.arrayContaining(['threadId', 'messageId']),
    );
  });

  it('aceita type user com campos completos', async () => {
    const dto = plainToInstance(InitUploadDto, {
      ...validInit,
      type: FileTypeEnum.USER,
      userId: 'user-1',
      threadId: 'thread-1',
      messageId: 'msg-1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita type inválido', async () => {
    const dto = plainToInstance(InitUploadDto, {
      ...validInit,
      type: 'outro',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });
});

describe('ConfirmUploadDto', () => {
  it('aceita type system sem threadId/messageId', async () => {
    const dto = plainToInstance(ConfirmUploadDto, validConfirm);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita userId ausente', async () => {
    const { userId: _userId, ...rest } = validConfirm;
    const dto = plainToInstance(ConfirmUploadDto, rest);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('rejeita userId vazio', async () => {
    const dto = plainToInstance(ConfirmUploadDto, {
      ...validConfirm,
      userId: '',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('exige threadId e messageId quando type é user', async () => {
    const dto = plainToInstance(ConfirmUploadDto, {
      ...validConfirm,
      type: FileTypeEnum.USER,
    });
    const errors = await validate(dto);
    const properties = errors.map((e) => e.property);
    expect(properties).toEqual(
      expect.arrayContaining(['threadId', 'messageId']),
    );
  });

  it('aceita type user com campos completos', async () => {
    const dto = plainToInstance(ConfirmUploadDto, {
      ...validConfirm,
      type: FileTypeEnum.USER,
      userId: 'user-1',
      threadId: 'thread-1',
      messageId: 'msg-1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('InitUploadBatchDto', () => {
  it('valida itens aninhados via Type', async () => {
    const dto = plainToInstance(InitUploadBatchDto, {
      files: [validInit],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.files[0]).toBeInstanceOf(InitUploadDto);
  });

  it('rejeita lista vazia', async () => {
    const dto = plainToInstance(InitUploadBatchDto, { files: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'files')).toBe(true);
  });
});

describe('ConfirmUploadBatchDto', () => {
  it('valida itens aninhados via Type', async () => {
    const dto = plainToInstance(ConfirmUploadBatchDto, {
      files: [validConfirm],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.files[0]).toBeInstanceOf(ConfirmUploadDto);
  });

  it('rejeita lista vazia', async () => {
    const dto = plainToInstance(ConfirmUploadBatchDto, { files: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'files')).toBe(true);
  });
});
