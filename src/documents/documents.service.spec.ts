import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';
import { VectorStoreService } from '../rag/vector-store.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsService } from './documents.service';
import { DocumentChunk } from './entities/document-chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import { TextExtractorService } from './extraction/text-extractor.service';
import { INGESTION_QUEUE } from './ingestion/ingestion.queue';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
  };

  const documentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };
  const chunkRepo = {
    delete: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const storageService = {
    generateUploadUrl: jest.fn(),
    getProperties: jest.fn(),
    delete: jest.fn(),
  };
  const vectorStoreService = {
    deleteByDocumentId: jest.fn(),
    deleteByAgentId: jest.fn(),
  };
  const textExtractor = { isSupported: jest.fn().mockReturnValue(true) };
  const queue = { enqueue: jest.fn() };

  const existingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const agentId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const owned = {
    id: existingId,
    userId: 'user-1',
    agentId,
    threadId: 'thread-1',
    filename: 'relatorio.txt',
    originalName: 'relatorio.txt',
    mimeType: 'text/plain',
    size: 10,
    blobName: 'user-1/doc/relatorio.txt',
    status: DocumentStatusEnum.Processed,
    error: null,
    chunkCount: 3,
    pageCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    textExtractor.isSupported.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: documentRepo,
        },
        {
          provide: getRepositoryToken(DocumentChunk),
          useValue: chunkRepo,
        },
        { provide: StorageService, useValue: storageService },
        { provide: VectorStoreService, useValue: vectorStoreService },
        { provide: TextExtractorService, useValue: textExtractor },
        { provide: INGESTION_QUEUE, useValue: queue },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) =>
              ({
                MAX_UPLOAD_SIZE_MB: 25,
                CHUNK_SIZE: 1000,
                CHUNK_OVERLAP: 200,
              })[key] ?? defaultValue,
          },
        },
      ],
    }).compile();
    service = module.get(DocumentsService);
  });

  describe('initUpload', () => {
    it('valida e retorna signed URL', async () => {
      storageService.generateUploadUrl.mockReturnValueOnce({
        signedUrl: 'http://blob?sastoken',
        blobName: `${agentId}/user-1/thread-1/msg-1/relatorio.txt`,
        expiresAt: new Date(),
      });

      const result = await service.initUpload(
        agentId,
        FileTypeEnum.USER,
        'relatorio.txt',
        'text/plain',
        1024,
        'user-1',
        'thread-1',
        'msg-1',
      );

      expect(storageService.generateUploadUrl).toHaveBeenCalledWith(
        `${agentId}/user-1/thread-1/msg-1/relatorio.txt`,
        'text/plain',
        1024,
      );
      expect(result.signedUrl).toBe('http://blob?sastoken');
      expect(result.blobName).toMatch(/relatorio\.txt$/);
    });

    it('rejeita tipo de arquivo não suportado', async () => {
      textExtractor.isSupported.mockReturnValue(false);

      await expect(
        service.initUpload(
          agentId,
          FileTypeEnum.SYSTEM,
          'x.exe',
          'application/x-msdownload',
          100,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storageService.generateUploadUrl).not.toHaveBeenCalled();
    });

    it('rejeita arquivo acima do limite', async () => {
      await expect(
        service.initUpload(
          agentId,
          FileTypeEnum.SYSTEM,
          'big.txt',
          'text/plain',
          26 * 1024 * 1024,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storageService.generateUploadUrl).not.toHaveBeenCalled();
    });

    it('rejeita agentId vazio', async () => {
      await expect(
        service.initUpload('', FileTypeEnum.SYSTEM, 'f.txt', 'text/plain', 100),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storageService.generateUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    it('verifica blob, cria documento e enfileira documentId', async () => {
      storageService.getProperties.mockResolvedValueOnce({
        size: 1024,
        contentType: 'text/plain',
        etag: '"etag123"',
      });
      documentRepo.create.mockImplementation(
        (data: Record<string, unknown>) => ({
          ...owned,
          id: existingId,
          ...data,
        }),
      );
      documentRepo.save.mockImplementation((data) =>
        Promise.resolve({ ...owned, id: existingId, ...data }),
      );

      const result = await service.confirmUpload(
        agentId,
        FileTypeEnum.USER,
        'user-1/doc/relatorio.txt',
        'relatorio.txt',
        'text/plain',
        1024,
        'thread-1',
        'msg-1',
        'user-1',
      );

      expect(storageService.getProperties).toHaveBeenCalledWith(
        'user-1/doc/relatorio.txt',
      );
      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          agentId,
          status: DocumentStatusEnum.Uploaded,
          blobName: 'user-1/doc/relatorio.txt',
        }),
      );
      expect(queue.enqueue).toHaveBeenCalledWith(existingId);
      expect(result.status).toBe(DocumentStatusEnum.Uploaded);
    });

    it('lança NotFound quando blob inexistente', async () => {
      storageService.getProperties.mockResolvedValueOnce(null);

      await expect(
        service.confirmUpload(
          agentId,
          FileTypeEnum.USER,
          'user-1/doc/missing.txt',
          'missing.txt',
          'text/plain',
          100,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('batches', () => {
    it('initUploadBatch retorna item por arquivo com originalName', async () => {
      storageService.generateUploadUrl.mockReturnValue({
        signedUrl: 'http://blob?sas',
        blobName: 'blob-a',
        expiresAt: new Date(),
      });

      const result = await service.initUploadBatch([
        {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          size: 10,
          agentId,
          type: FileTypeEnum.SYSTEM,
          userId: 'system',
        },
      ]);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].originalName).toBe('a.txt');
      expect(result.items[0].signedUrl).toBe('http://blob?sas');
    });

    it('confirmUploadBatch confirma cada arquivo', async () => {
      storageService.getProperties.mockResolvedValue({
        size: 10,
        contentType: 'text/plain',
        etag: 'e',
      });
      documentRepo.create.mockImplementation((data) => ({ ...owned, ...data }));
      documentRepo.save.mockImplementation((data) =>
        Promise.resolve({ ...owned, ...data }),
      );

      const result = await service.confirmUploadBatch([
        {
          blobName: 'blob-a',
          originalName: 'a.txt',
          mimeType: 'text/plain',
          size: '10',
          agentId,
          type: FileTypeEnum.SYSTEM,
        },
      ] as any);

      expect(result.items).toHaveLength(1);
      expect(queue.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('aplica paginação padrão quando não fornecida', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('user-1', { userId: 'user-1' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'doc.userId = :userId',
        { userId: 'user-1' },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'doc.createdAt',
        'DESC',
      );
    });

    it('aplica filtro agentId quando fornecido', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('user-1', { userId: 'user-1', agentId });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.agentId = :agentId',
        { agentId },
      );
    });

    it('aplica filtro status quando fornecido', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('user-1', { userId: 'user-1', status: DocumentStatusEnum.Processed });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.status = :status',
        { status: DocumentStatusEnum.Processed },
      );
    });

    it('aplica filtro search quando fornecido', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('user-1', { userId: 'user-1', search: 'relatorio' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.originalName ILIKE :search',
        { search: '%relatorio%' },
      );
    });

    it('aplica página e limit customizados', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('user-1', { userId: 'user-1', page: 3, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('escapa caracteres LIKE no search', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list('user-1', { userId: 'user-1', search: '100%_complete' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.originalName ILIKE :search',
        { search: '%100\\%\\_complete%' },
      );
    });

    it('retorna itens mapeados via DocumentConverter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[owned], 1]);

      const result = await service.list('user-1', { userId: 'user-1' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(existingId);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getById', () => {
    it('retorna documento quando encontrado', async () => {
      documentRepo.findOne.mockResolvedValueOnce(owned);

      const result = await service.getById(existingId, 'user-1');

      expect(result.id).toBe(existingId);
    });

    it('lança NotFound quando documento não encontrado', async () => {
      documentRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getById('id-invalido', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('remove blob, chunks, pontos no vector store e o documento', async () => {
      documentRepo.findOne.mockResolvedValueOnce(owned);

      await service.delete(existingId, 'user-1');

      expect(storageService.delete).toHaveBeenCalledWith(owned.blobName);
      expect(chunkRepo.delete).toHaveBeenCalledWith({ documentId: owned.id });
      expect(vectorStoreService.deleteByDocumentId).toHaveBeenCalledWith(
        existingId,
      );
      expect(documentRepo.delete).toHaveBeenCalledWith({ id: owned.id });
    });

    it('não permite excluir documento de outro usuário', async () => {
      documentRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.delete(existingId, 'user-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(documentRepo.findOne).toHaveBeenCalledWith({
        where: { id: existingId, userId: 'user-2' },
      });
      expect(storageService.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteByAgent', () => {
    it('retorna 0 quando nenhum documento encontrado', async () => {
      documentRepo.find.mockResolvedValueOnce([]);

      const result = await service.deleteByAgent(agentId, 'user-1');

      expect(result).toBe(0);
    });

    it('remove todos artefatos do agente e loga falha de blob', async () => {
      const docs = [
        { ...owned, blobName: 'blob-1' },
        { ...owned, id: 'doc-2', blobName: 'blob-2' },
      ];
      documentRepo.find.mockResolvedValueOnce(docs);
      storageService.delete
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('blob fail'));

      const result = await service.deleteByAgent(agentId, 'user-1');

      expect(result).toBe(2);
      expect(storageService.delete).toHaveBeenCalledWith('blob-1');
      expect(storageService.delete).toHaveBeenCalledWith('blob-2');
      expect(chunkRepo.delete).toHaveBeenCalledWith({ agentId });
      expect(vectorStoreService.deleteByAgentId).toHaveBeenCalledWith(agentId);
      expect(documentRepo.delete).toHaveBeenCalledWith({ agentId });
    });
  });

  describe('reprocess', () => {
    it('reseta status e reenfileira o documentId', async () => {
      documentRepo.findOne.mockResolvedValue(owned);

      const result = await service.reprocess(existingId);

      expect(documentRepo.update).toHaveBeenCalledWith(
        { id: owned.id },
        { status: DocumentStatusEnum.Uploaded, error: null },
      );
      expect(queue.enqueue).toHaveBeenCalledWith(existingId);
      expect(result.documentId).toBe(existingId);
    });
  });

  describe('getStatus', () => {
    it('retorna status direto do documento', async () => {
      documentRepo.findOne.mockResolvedValueOnce(owned);

      const result = await service.getStatus(existingId, 'user-1');

      expect(result.status).toBe(DocumentStatusEnum.Processed);
      expect(result.chunkCount).toBe(3);
      expect(result.documentId).toBe(existingId);
    });
  });

  describe('countByAgent', () => {
    it('retorna contagem por agente', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { agentId, count: '5' },
        { agentId: 'agent-2', count: '3' },
      ]);

      const result = await service.countByAgent('user-1');

      expect(result).toEqual({ [agentId]: 5, 'agent-2': 3 });
    });

    it('retorna objeto vazio quando não há registros', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.countByAgent('user-1');

      expect(result).toEqual({});
    });

    it('filtra agentId null', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { agentId: null, count: '2' },
        { agentId, count: '5' },
      ]);

      const result = await service.countByAgent('user-1');

      expect(Object.keys(result)).not.toContain('null');
      expect(result).toEqual({ [agentId]: 5 });
    });
  });

  describe('assignAgentToOrphans', () => {
    it('atualiza documentos e chunks órfãos', async () => {
      documentRepo.update.mockResolvedValue({ affected: 3 });
      chunkRepo.update.mockResolvedValue({ affected: 3 });

      const result = await service.assignAgentToOrphans('user-1', agentId);

      expect(documentRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', agentId: null },
        { agentId },
      );
      expect(chunkRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', agentId: null },
        { agentId },
      );
      expect(result).toBe(3);
    });

    it('retorna 0 quando nenhum órfão', async () => {
      documentRepo.update.mockResolvedValue({ affected: 0 });
      chunkRepo.update.mockResolvedValue({ affected: 0 });

      const result = await service.assignAgentToOrphans('user-1', agentId);

      expect(result).toBe(0);
    });

    it('usa fallback 0 quando affected é undefined', async () => {
      documentRepo.update.mockResolvedValue({ affected: undefined });
      chunkRepo.update.mockResolvedValue({ affected: undefined });

      const result = await service.assignAgentToOrphans('user-1', agentId);

      expect(result).toBe(0);
    });
  });

  describe('distinctUserIds', () => {
    it('retorna lista de userIds distintos', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result = await service.distinctUserIds();

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('retorna array vazio quando não há documentos', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.distinctUserIds();

      expect(result).toEqual([]);
    });
  });

  describe('countByUser', () => {
    it('retorna contagens agregadas por status', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { status: DocumentStatusEnum.Processed, count: '10' },
        { status: DocumentStatusEnum.Processing, count: '3' },
        { status: DocumentStatusEnum.Uploaded, count: '2' },
        { status: DocumentStatusEnum.Failed, count: '1' },
      ]);

      const result = await service.countByUser('user-1');

      expect(result).toEqual({
        total: 16,
        processed: 10,
        processing: 5,
        failed: 1,
      });
    });

    it('retorna zeros quando não há documentos', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.countByUser('user-1');

      expect(result).toEqual({
        total: 0,
        processed: 0,
        processing: 0,
        failed: 0,
      });
    });
  });

  describe('getChunks', () => {
    it('retorna chunks do documento com paginação padrão', async () => {
      documentRepo.findOne.mockResolvedValueOnce(owned);
      chunkRepo.find.mockResolvedValueOnce([
        { chunkId: 'c1', chunkIndex: 0, page: 1, text: 'text1' },
        { chunkId: 'c2', chunkIndex: 1, page: 2, text: 'text2' },
      ] as DocumentChunk[]);

      const result = await service.getChunks(existingId, 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0].chunkId).toBe('c1');
      expect(chunkRepo.find).toHaveBeenCalledWith({
        where: { documentId: existingId, userId: 'user-1' },
        order: { chunkIndex: 'ASC' },
        skip: 0,
        take: 50,
      });
    });

    it('filtra por página quando fornecido', async () => {
      documentRepo.findOne.mockResolvedValueOnce(owned);
      chunkRepo.find.mockResolvedValueOnce([]);

      await service.getChunks(existingId, 'user-1', { page: 1 });

      expect(chunkRepo.find).toHaveBeenCalledWith({
        where: { documentId: existingId, userId: 'user-1', page: 1 },
        order: { chunkIndex: 'ASC' },
        skip: 0,
        take: 50,
      });
    });

    it('aplica offset e limit customizados', async () => {
      documentRepo.findOne.mockResolvedValueOnce(owned);
      chunkRepo.find.mockResolvedValueOnce([]);

      await service.getChunks(existingId, 'user-1', { offset: 10, limit: 5 });

      expect(chunkRepo.find).toHaveBeenCalledWith({
        where: { documentId: existingId, userId: 'user-1' },
        order: { chunkIndex: 'ASC' },
        skip: 10,
        take: 5,
      });
    });

    it('lança NotFound quando documento não encontrado', async () => {
      documentRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getChunks(existingId, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
