import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { Repository } from 'typeorm';
import type { EmbeddingProvider } from '../../embeddings/types/embedding-provider.interface';
import { EMBEDDING_PROVIDER } from '../../embeddings/types/embedding-provider.interface';
import { ChunkVectorPoint } from '../../rag/types/rag.types';
import { VectorStoreService } from '../../rag/vector-store.service';
import { StorageService } from '../../storage/storage.service';
import { Chunker } from '../../util/chunker';
import { DocumentEventsService } from '../document-events.service';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { DocumentEntity } from '../entities/document.entity';
import { TextExtractorService } from '../extraction/text-extractor.service';

const EMBEDDING_BATCH_SIZE = 64;

export interface IngestBlobScope {
  userId: string;
  agentId: string;
  documentId?: string;
  sessionId?: string;
  filename?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestBlobResult {
  chunkIds: string[];
  vectors: number[][];
  pages: Array<{ page: number | null; text: string }>;
  chunks: Array<{ index: number; page: number | null; text: string }>;
  pageCount: number | null;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly chunker = new Chunker();

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly storageService: StorageService,
    private readonly textExtractor: TextExtractorService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorStoreService: VectorStoreService,
    private readonly documentEvents: DocumentEventsService,
  ) {}

  async process(documentId: string): Promise<void> {
    const document = await this.documentRepo.findOneBy({ id: documentId });
    if (!document) {
      this.logger.warn(`Documento ${documentId} não encontrado — ignorando`);
      return;
    }

    this.logger.log(`Processando documento "${document.originalName}"`);
    await this.documentRepo.update(
      { id: documentId },
      { status: DocumentStatusEnum.Processing, error: null },
    );
    this.documentEvents.emit({
      documentId,
      agentId: document.agentId,
      status: DocumentStatusEnum.Processing,
      error: null,
      chunkCount: 0,
      pageCount: null,
    });

    try {
      const buffer = await this.storageService.download(document.blobName);
      const pages = await this.textExtractor.extract(
        buffer,
        document.originalName,
        document.mimeType,
      );
      if (pages.length === 0) {
        throw new Error('Nenhum texto extraído do documento');
      }

      const chunks = await this.chunker.chunk(pages, {
        chunkSize: document.chunkSize,
        chunkOverlap: document.chunkOverlap,
      });
      if (chunks.length === 0) {
        throw new Error('Chunking não produziu nenhum trecho');
      }

      await this.chunkRepo.delete({ documentId });
      await this.vectorStoreService.deleteByDocumentId(documentId);

      const chunkIds = chunks.map(() => randomUUID());
      await this.chunkRepo.save(
        chunks.map((chunk, i) =>
          this.chunkRepo.create({
            documentId,
            agentId: document.agentId,
            userId: document.userId,
            chunkId: chunkIds[i],
            chunkIndex: chunk.index,
            page: chunk.page,
            text: chunk.text,
            tokenEstimate: Math.ceil(chunk.text.length / 4),
          }),
        ),
      );

      const vectors: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchVectors = await this.embeddingProvider.embed(
          batch.map((chunk) => chunk.text),
        );
        vectors.push(...batchVectors);
      }

      const points: ChunkVectorPoint[] = chunks.map((chunk, i) => ({
        id: chunkIds[i],
        vector: vectors[i],
        payload: {
          documentId,
          agentId: document.agentId,
          chunkId: chunkIds[i],
          filename: document.originalName,
          page: chunk.page,
          chunkIndex: chunk.index,
          metadata: document.metadata ?? {},
          userId: document.userId,
          threadId: document.threadId,
          text: chunk.text,
        },
      }));

      await this.vectorStoreService.upsertChunks(points);

      const pageCount =
        Math.max(...pages.map((page) => page.page ?? 0), 0) || null;
      const updateResult = await this.documentRepo.update(
        { id: documentId },
        {
          status: DocumentStatusEnum.Processed,
          error: null,
          chunkCount: chunks.length,
          pageCount,
        },
      );

      // Documento removido durante o processamento (ex.: usuário clicou em
      // remover). Desfaz os chunks/vetores recém-gravados para não deixar órfãos.
      if (!updateResult.affected) {
        this.logger.warn(
          `Documento ${documentId} removido durante o processamento — descartando chunks/vetores`,
        );
        await this.chunkRepo.delete({ documentId });
        await this.vectorStoreService.deleteByDocumentId(documentId);
        return;
      }

      this.documentEvents.emit({
        documentId,
        agentId: document.agentId,
        status: DocumentStatusEnum.Processed,
        error: null,
        chunkCount: chunks.length,
        pageCount,
      });
      this.logger.log(
        `Documento "${document.originalName}" processado: ${chunks.length} chunks indexados`,
      );
    } catch (error) {
      const message =
        (error as Error).message ?? 'Erro desconhecido na ingestão';
      this.logger.error(
        `Falha ao processar documento ${documentId}: ${message}`,
      );
      await this.documentRepo.update(
        { id: documentId },
        { status: DocumentStatusEnum.Failed, error: message },
      );
      this.documentEvents.emit({
        documentId,
        agentId: document.agentId,
        status: DocumentStatusEnum.Failed,
        error: message,
        chunkCount: 0,
        pageCount: null,
      });
    }
  }

  async failInterrupted(): Promise<number> {
    const result = await this.documentRepo.update(
      { status: DocumentStatusEnum.Processing },
      {
        status: DocumentStatusEnum.Failed,
        error: 'Processamento interrompido por reinício do servidor',
      },
    );
    return result.affected ?? 0;
  }

  async findPendingDocumentIds(): Promise<string[]> {
    const documents = await this.documentRepo.find({
      where: { status: DocumentStatusEnum.Uploaded },
      select: { id: true },
      order: { createdAt: 'ASC' },
    });
    return documents.map((document) => document.id);
  }

  async ingestBlob(
    blobName: string,
    originalName: string,
    mimeType: string,
    scope: IngestBlobScope,
    chunkSize?: number,
    chunkOverlap?: number,
  ): Promise<IngestBlobResult> {
    const buffer = await this.storageService.download(blobName);
    const pages = await this.textExtractor.extract(
      buffer,
      originalName,
      mimeType,
    );
    if (pages.length === 0) {
      throw new Error('Nenhum texto extraído do arquivo');
    }

    const cs = chunkSize ?? 1000;
    const co = chunkOverlap ?? 200;
    const chunks = await this.chunker.chunk(pages, {
      chunkSize: cs,
      chunkOverlap: co,
    });
    if (chunks.length === 0) {
      throw new Error('Chunking não produziu nenhum trecho');
    }

    const chunkIds = chunks.map(() => randomUUID());

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchVectors = await this.embeddingProvider.embed(
        batch.map((chunk) => chunk.text),
      );
      vectors.push(...batchVectors);
    }

    const points: ChunkVectorPoint[] = chunks.map((chunk, i) => ({
      id: chunkIds[i],
      vector: vectors[i],
      payload: {
        documentId: scope.documentId ?? chunkIds[i],
        agentId: scope.agentId,
        chunkId: chunkIds[i],
        sessionId: scope.sessionId,
        filename: scope.filename ?? originalName,
        page: chunk.page,
        chunkIndex: chunk.index,
        metadata: scope.metadata ?? {},
        userId: scope.userId,
        text: chunk.text,
      },
    }));

    await this.vectorStoreService.upsertChunks(points);

    const pageCount =
      Math.max(...pages.map((page) => page.page ?? 0), 0) || null;

    return { chunkIds, vectors, pages, chunks, pageCount };
  }
}
