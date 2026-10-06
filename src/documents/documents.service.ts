import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';
import { Repository } from 'typeorm';
import { VectorStoreService } from '../rag/vector-store.service';
import { StorageService } from '../storage/storage.service';
import { SignedUrl } from '../storage/types/storage.types';
import { DocumentConverter } from './converters/document.converter';
import { ConfirmUploadBatchResponseDto } from './dto/confirm-upload-batch.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import {
  DocumentResponseDto,
  PaginatedDocumentsResponseDto,
} from './dto/document.response.dto';
import { InitUploadBatchResponseDto } from './dto/init-upload-batch.dto';
import { InitUploadDto, InitUploadResponseDto } from './dto/init-upload.dto';
import { DocumentStatusResponseDto } from './dto/job-status.response.dto';
import { ListDocumentsQueryDto } from './dto/list-documents.query.dto';
import { DocumentChunk } from './entities/document-chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import { TextExtractorService } from './extraction/text-extractor.service';
import type { IngestionQueue } from './ingestion/ingestion.queue';
import { INGESTION_QUEUE } from './ingestion/ingestion.queue';

export interface DocumentCounts {
  total: number;
  processed: number;
  processing: number;
  failed: number;
}

export interface ChunkListing {
  chunkId: string;
  chunkIndex: number;
  page: number | null;
  text: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxUploadBytes: number;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly storageService: StorageService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly textExtractor: TextExtractorService,
    @Inject(INGESTION_QUEUE)
    private readonly ingestionQueue: IngestionQueue,
    configService: ConfigService,
  ) {
    this.maxUploadBytes =
      configService.get<number>('MAX_UPLOAD_SIZE_MB', 25) * 1024 * 1024;
    this.chunkSize = configService.get<number>('CHUNK_SIZE', 1000);
    this.chunkOverlap = configService.get<number>('CHUNK_OVERLAP', 200);
  }

  async initUpload(
    agentId: string,
    type: FileTypeEnum,
    originalName: string,
    mimeType: string,
    size: number,
    userId?: string,
    threadId?: string,
    messageId?: string,
  ): Promise<InitUploadResponseDto> {
    this.logger.log(
      `Init upload "${originalName}" (${size} bytes) (type ${type}) por ${userId} no agente ${agentId}`,
    );

    if (size > this.maxUploadBytes) {
      throw new BadRequestException(
        `Arquivo excede o limite de ${this.maxUploadBytes / (1024 * 1024)} MB`,
      );
    }

    if (!this.textExtractor.isSupported(originalName, mimeType)) {
      throw new BadRequestException(
        'Tipo de arquivo não suportado. Aceitos: PDF, DOCX, TXT, Markdown, CSV, HTML e JSON',
      );
    }

    if (!agentId) {
      this.logger.warn(`AgentId vazio`);
      throw new BadRequestException(`AgentId é obrigatório`);
    }

    const safeName = this.sanitizeFilename(originalName);

    let blobName = `${agentId}`;
    if (type === FileTypeEnum.SYSTEM) blobName = `/base`;

    if (type === FileTypeEnum.USER)
      blobName += `/${userId}/${threadId}/${messageId}`;

    blobName += `/${safeName}`;

    const signed: SignedUrl = this.storageService.generateUploadUrl(
      blobName,
      mimeType,
      size,
    );

    this.logger.log(`URL autoassinada gerada para blob "${blobName}"`);
    return {
      signedUrl: signed.signedUrl,
      blobName: signed.blobName,
      expiresAt: signed.expiresAt,
    };
  }

  async initUploadBatch(
    files: InitUploadDto[],
  ): Promise<InitUploadBatchResponseDto> {
    this.logger.log(`Init upload em lote de ${files.length} arquivo(s)`);
    const items = await Promise.all(
      files.map(async (file) => {
        const signed = await this.initUpload(
          file.agentId,
          file.type,
          file.originalName,
          file.mimeType,
          file.size,
          file.userId,
          file.threadId,
          file.messageId,
        );
        return { ...signed, originalName: file.originalName };
      }),
    );
    return { items };
  }

  async confirmUploadBatch(
    files: ConfirmUploadDto[],
  ): Promise<ConfirmUploadBatchResponseDto> {
    this.logger.log(`Confirm upload em lote de ${files.length} arquivo(s)`);
    const items = await Promise.all(
      files.map((file) =>
        this.confirmUpload(
          file.agentId,
          file.type,
          file.blobName,
          file.originalName,
          file.mimeType,
          Number(file.size),
          file.threadId,
          file.messageId,
          file.userId,
        ),
      ),
    );
    return { items };
  }

  async confirmUpload(
    agentId: string,

    type: FileTypeEnum,
    blobName: string,
    originalName: string,
    mimeType: string,
    size: number,
    threadId?: string,
    messageId?: string,
    userId?: string,
  ): Promise<DocumentResponseDto> {
    this.logger.log(
      `Confirm upload blob "${blobName}" por ${userId} no agente ${agentId}`,
    );
    const props = await this.storageService.getProperties(blobName);
    if (!props) {
      throw new NotFoundException('Blob não encontrado no storage');
    }
    const document = this.documentRepo.create({
      userId,
      agentId,
      threadId,
      messageId,
      filename: this.sanitizeFilename(originalName),
      originalName,
      mimeType,
      size,
      type,
      blobName,
      blobUrl: props.etag,
      status: DocumentStatusEnum.Uploaded,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
    const saved = await this.documentRepo.save(document);

    this.ingestionQueue.enqueue(saved.id);
    this.logger.log(
      `Documento ${saved.id} criado a partir de blob e enfileirado para ingestão`,
    );
    return DocumentConverter.toResponse(saved);
  }

  async list(
    userId: string,
    query: ListDocumentsQueryDto,
  ): Promise<PaginatedDocumentsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.documentRepo.createQueryBuilder('doc');
    qb.where('doc.userId = :userId', { userId });

    if (query.agentId) {
      qb.andWhere('doc.agentId = :agentId', { agentId: query.agentId });
    }
    if (query.threadId) {
      qb.andWhere('doc.threadId = :threadId', { threadId: query.threadId });
    }
    if (query.status) {
      qb.andWhere('doc.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere('doc.originalName ILIKE :search', {
        search: `%${this.escapeLike(query.search)}%`,
      });
    }

    const [items, total] = await qb
      .orderBy('doc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: items.map((item) => DocumentConverter.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getById(id: string, userId: string): Promise<DocumentResponseDto> {
    const document = await this.findOwned(id, userId);
    return DocumentConverter.toResponse(document);
  }

  async delete(id: string, userId: string): Promise<void> {
    const document = await this.findOwned(id, userId);
    this.logger.log(`Excluindo documento ${id} e artefatos associados`);
    await this.storageService.delete(document.blobName);
    await this.chunkRepo.delete({ documentId: document.id });

    await this.vectorStoreService.deleteByDocumentId(id);

    await this.documentRepo.delete({ id: document.id });
    this.logger.log(`Documento ${id} excluído`);
  }

  async reprocess(id: string): Promise<DocumentStatusResponseDto> {
    const document = await this.findOwned(id);
    this.logger.log(`Reprocessando documento ${id}`);
    await this.documentRepo.update(
      { id: document.id },
      { status: DocumentStatusEnum.Uploaded, error: null },
    );
    this.ingestionQueue.enqueue(id);
    const refreshed = await this.findOwned(id);
    return DocumentConverter.toStatusResponse(refreshed);
  }

  async getStatus(
    id: string,
    userId: string,
  ): Promise<DocumentStatusResponseDto> {
    const document = await this.findOwned(id, userId);
    return DocumentConverter.toStatusResponse(document);
  }

  async deleteByAgent(agentId: string, userId: string): Promise<number> {
    const documents = await this.documentRepo.find({
      where: { agentId, userId },
    });
    if (documents.length === 0) {
      return 0;
    }
    this.logger.log(
      `Excluindo ${documents.length} documento(s) do agente ${agentId}`,
    );
    const blobResults = await Promise.allSettled(
      documents.map((document) =>
        this.storageService.delete(document.blobName),
      ),
    );
    for (const result of blobResults) {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Falha ao excluir blob durante cascade do agente ${agentId}: ${String(result.reason)}`,
        );
      }
    }
    await this.chunkRepo.delete({ agentId });
    await this.vectorStoreService.deleteByAgentId(agentId);
    await this.documentRepo.delete({ agentId });
    return documents.length;
  }

  async countByAgent(userId: string): Promise<Record<string, number>> {
    const rows = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.agentId', 'agentId')
      .addSelect('COUNT(*)', 'count')
      .where('doc.userId = :userId', { userId })
      .groupBy('doc.agentId')
      .getRawMany<{ agentId: string; count: number }>();
    return Object.fromEntries(
      rows
        .filter((row) => row.agentId !== null)
        .map((row) => [String(row.agentId), Number(row.count)]),
    );
  }

  async assignAgentToOrphans(userId: string, agentId: string): Promise<number> {
    const result = await this.documentRepo.update(
      { userId, agentId: null as unknown as string },
      { agentId },
    );
    await this.chunkRepo.update(
      { userId, agentId: null as unknown as string },
      { agentId },
    );
    return result.affected ?? 0;
  }

  async distinctUserIds(): Promise<string[]> {
    const rows = await this.documentRepo
      .createQueryBuilder('doc')
      .select('DISTINCT doc.userId', 'userId')
      .getRawMany<{ userId: string }>();
    return rows.map((r) => r.userId);
  }

  async countByUser(userId: string): Promise<DocumentCounts> {
    const rows = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('doc.userId = :userId', { userId })
      .groupBy('doc.status')
      .getRawMany<{ status: DocumentStatusEnum; count: number }>();
    const byStatus = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.count)]),
    );
    return {
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
      processed: byStatus[DocumentStatusEnum.Processed] ?? 0,
      processing:
        (byStatus[DocumentStatusEnum.Processing] ?? 0) +
        (byStatus[DocumentStatusEnum.Uploaded] ?? 0),
      failed: byStatus[DocumentStatusEnum.Failed] ?? 0,
    };
  }

  async getChunks(
    documentId: string,
    userId: string,
    options: { page?: number; offset?: number; limit?: number } = {},
  ): Promise<ChunkListing[]> {
    await this.findOwned(documentId, userId);
    const where: Record<string, unknown> = {
      documentId,
      userId,
    };
    if (options.page !== undefined) {
      where.page = options.page;
    }
    const chunks = await this.chunkRepo.find({
      where,
      order: { chunkIndex: 'ASC' },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      page: chunk.page,
      text: chunk.text,
    }));
  }

  private async findOwned(
    id: string,
    userId?: string,
  ): Promise<DocumentEntity> {
    const document = await this.documentRepo.findOne({
      where: { id, userId },
    });
    if (!document) {
      this.logger.warn(`Documento ${id} não encontrado para usuário ${userId}`);
      throw new NotFoundException('Documento não encontrado');
    }
    return document;
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').slice(-180);
  }

  private escapeLike(value: string): string {
    return value.replace(/[%_]/g, '\\$&');
  }
}
