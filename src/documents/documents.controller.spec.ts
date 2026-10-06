import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';
import { DocumentEventsService } from './document-events.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  const mockService = {
    initUpload: jest.fn(),
    initUploadBatch: jest.fn(),
    confirmUpload: jest.fn(),
    confirmUploadBatch: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    delete: jest.fn(),
    getStatus: jest.fn(),
  };

  const mockEvents = { stream: jest.fn(), emit: jest.fn() };

  const userId = 'user-1';
  const agentId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: mockService },
        { provide: DocumentEventsService, useValue: mockEvents },
      ],
    }).compile();

    controller = module.get(DocumentsController);
  });

  it('initUpload chama service e retorna signed URL', async () => {
    const dto = {
      originalName: 'doc.txt',
      mimeType: 'text/plain',
      size: 100,
      agentId,
      type: FileTypeEnum.USER,
      userId,
      threadId: 'thread-1',
      messageId: 'msg-1',
    };
    const expected = {
      signedUrl: 'http://blob?sas',
      blobName: 'blob',
      expiresAt: new Date(),
    };
    mockService.initUpload.mockResolvedValueOnce(expected);

    const result = await controller.initUpload(dto);

    expect(mockService.initUpload).toHaveBeenCalledWith(
      dto.agentId,
      dto.type,
      dto.originalName,
      dto.mimeType,
      dto.size,
      dto.userId,
      dto.threadId,
      dto.messageId,
    );
    expect(result).toEqual(expected);
  });

  it('confirmUpload chama service e retorna documento', async () => {
    const dto = {
      blobName: 'blob',
      originalName: 'doc.txt',
      mimeType: 'text/plain',
      size: '100',
      agentId,
      type: FileTypeEnum.USER,
      userId,
      threadId: 'thread-1',
      messageId: 'msg-1',
    };
    const expected = {
      id: 'doc-1',
      agentId,
      filename: 'doc.txt',
      originalName: 'doc.txt',
      mimeType: 'text/plain',
      size: 100,
      status: DocumentStatusEnum.Uploaded,
      error: null,
      chunkCount: 0,
      pageCount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.confirmUpload.mockResolvedValueOnce(expected);

    const result = await controller.confirmUpload(dto as any);

    expect(mockService.confirmUpload).toHaveBeenCalledWith(
      dto.agentId,
      dto.type,
      dto.blobName,
      dto.originalName,
      dto.mimeType,
      Number(dto.size),
      dto.threadId,
      dto.messageId,
      dto.userId,
    );
    expect(result).toEqual(expected);
  });

  it('initUploadBatch delega para o service', async () => {
    const files = [
      {
        originalName: 'a.txt',
        mimeType: 'text/plain',
        size: 10,
        agentId,
        type: FileTypeEnum.SYSTEM,
        userId: 'system',
      },
    ];
    const expected = { items: [] };
    mockService.initUploadBatch.mockResolvedValueOnce(expected);

    const result = await controller.initUploadBatch({ files });

    expect(mockService.initUploadBatch).toHaveBeenCalledWith(files);
    expect(result).toEqual(expected);
  });

  it('confirmUploadBatch delega para o service', async () => {
    const files = [
      {
        blobName: 'blob',
        originalName: 'a.txt',
        mimeType: 'text/plain',
        size: '10',
        agentId,
        type: FileTypeEnum.SYSTEM,
        userId: 'system',
      },
    ];
    const expected = { items: [] };
    mockService.confirmUploadBatch.mockResolvedValueOnce(expected);

    const result = await controller.confirmUploadBatch({ files } as any);

    expect(mockService.confirmUploadBatch).toHaveBeenCalledWith(files);
    expect(result).toEqual(expected);
  });

  it('list retorna documentos paginados', async () => {
    const query = { userId, page: 1, limit: 20 };
    const expected = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    };
    mockService.list.mockResolvedValueOnce(expected);

    const result = await controller.list(query);

    expect(mockService.list).toHaveBeenCalledWith(userId, query);
    expect(result).toEqual(expected);
  });

  it('getById retorna documento', async () => {
    const id = 'doc-1';
    const expected = {
      id,
      agentId,
      filename: 'doc.txt',
      originalName: 'doc.txt',
      mimeType: 'text/plain',
      size: 100,
      status: DocumentStatusEnum.Processed,
      error: null,
      chunkCount: 3,
      pageCount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.getById.mockResolvedValueOnce(expected);

    const result = await controller.getById(id, userId);

    expect(mockService.getById).toHaveBeenCalledWith(id, userId);
    expect(result).toEqual(expected);
  });

  it('delete chama service com id e userId', async () => {
    const id = 'doc-1';

    await controller.delete(id, userId);

    expect(mockService.delete).toHaveBeenCalledWith(id, userId);
  });

  it('getStatus retorna status do documento', async () => {
    const id = 'doc-1';
    const expected = {
      documentId: id,
      status: DocumentStatusEnum.Processed,
      error: null,
      chunkCount: 3,
      pageCount: null,
      updatedAt: new Date(),
    };
    mockService.getStatus.mockResolvedValueOnce(expected);

    const result = await controller.getStatus(id, userId);

    expect(mockService.getStatus).toHaveBeenCalledWith(id, userId);
    expect(result).toEqual(expected);
  });

  it('getById rejeita userId vazio', async () => {
    await expect(controller.getById('doc-1', '')).rejects.toThrow(
      'userId é obrigatório',
    );
    expect(mockService.getById).not.toHaveBeenCalled();
  });

  it('delete rejeita userId vazio', async () => {
    await expect(controller.delete('doc-1', '')).rejects.toThrow(
      'userId é obrigatório',
    );
    expect(mockService.delete).not.toHaveBeenCalled();
  });

  it('getStatus rejeita userId vazio', async () => {
    await expect(controller.getStatus('doc-1', '')).rejects.toThrow(
      'userId é obrigatório',
    );
    expect(mockService.getStatus).not.toHaveBeenCalled();
  });

  it('events retorna stream mapeado para MessageEvent', async () => {
    const event = {
      documentId: 'doc-1',
      agentId,
      status: DocumentStatusEnum.Processed,
      error: null,
      chunkCount: 3,
      pageCount: 1,
    };
    mockEvents.stream.mockReturnValueOnce(of(event));

    const message = await firstValueFrom(controller.events(agentId));

    expect(mockEvents.stream).toHaveBeenCalledWith(agentId);
    expect(message).toEqual({ data: event });
  });

  it('events sem agentId assina stream geral', async () => {
    mockEvents.stream.mockReturnValueOnce(of());

    controller.events(undefined);

    expect(mockEvents.stream).toHaveBeenCalledWith(undefined);
  });
});
