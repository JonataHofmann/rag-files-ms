import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ChunkEmbedding } from './entities/chunk-embedding.entity';
import {
  ChunkVectorPoint,
  VectorSearchFilter,
  VectorSearchResult,
} from './types/rag.types';

const UPSERT_BATCH_SIZE = 100;

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private ready = false;

  constructor(
    @InjectRepository(ChunkEmbedding)
    private readonly embeddingRepo: Repository<ChunkEmbedding>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.embeddingRepo.find({ take: 1 });
      this.ready = true;
      this.logger.log('Vector store pronto (pgvector via TypeORM)');
    } catch (error) {
      this.logger.error(
        `Tabela "chunk_embeddings" indisponível — rode as migrations (npm run migration:run): ${(error as Error).message}`,
      );
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private ensureReady(): void {
    if (!this.ready) {
      throw new Error(
        'Vector store não inicializado (tabela pgvector ausente — rode as migrations)',
      );
    }
  }

  async upsertChunks(points: ChunkVectorPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }
    this.ensureReady();
    for (let i = 0; i < points.length; i += UPSERT_BATCH_SIZE) {
      const batch = points.slice(i, i + UPSERT_BATCH_SIZE);
      const entities: QueryDeepPartialEntity<ChunkEmbedding>[] = batch.map(
        (point) => ({
          chunkId: point.id,
          documentId: point.payload.documentId as string,
          agentId: point.payload.agentId as string,
          userId: (point.payload.userId as string | null) ?? null,
          threadId: (point.payload.threadId as string | null) ?? null,
          embedding: point.vector,
          payload: point.payload as QueryDeepPartialEntity<
            Record<string, unknown>
          >,
        }),
      );
      await this.embeddingRepo.upsert(entities, ['chunkId']);
    }
    this.logger.log(`${points.length} vetor(es) indexados no pgvector`);
  }

  async search(
    vector: number[],
    filter: VectorSearchFilter = {},
  ): Promise<VectorSearchResult[]> {
    this.ensureReady();
    const qb = this.embeddingRepo
      .createQueryBuilder('ce')
      .select('ce.chunkId', 'chunkId')
      .addSelect('ce.payload', 'payload')
      .addSelect('1 - (ce.embedding <=> :qvector::vector)', 'score')
      .orderBy('ce.embedding <=> :qvector::vector', 'ASC')
      .setParameter('qvector', `[${vector.join(',')}]`)
      .limit(filter.limit ?? 8);

    if (filter.agentId) {
      qb.andWhere('ce.agentId = :agentId', { agentId: filter.agentId });
    }
    if (filter.userId) {
      qb.andWhere('ce.userId = :userId', { userId: filter.userId });
    }
    if (filter.documentId) {
      qb.andWhere('ce.documentId = :documentId', {
        documentId: filter.documentId,
      });
    }
    if (filter.threadId) {
      qb.andWhere('ce.threadId = :threadId', { threadId: filter.threadId });
    }

    const startedAt = Date.now();
    const rows = await qb.getRawMany<{
      chunkId: string;
      score: string | number;
      payload: Record<string, unknown>;
    }>();
    this.logger.log(
      `[RAG-MS] 3/4 busca pgvector | agent=${filter.agentId ?? '-'} user=${filter.userId ?? '-'} doc=${filter.documentId ?? '-'} thread=${filter.threadId ?? '-'} limit=${filter.limit ?? 8} rows=${rows.length} ${Date.now() - startedAt}ms`,
    );

    return rows.map((row) => ({
      chunkId: row.chunkId,
      score: Number(row.score),
      payload: row.payload,
    }));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    if (!this.ready) {
      return;
    }
    await this.embeddingRepo.delete({ documentId });
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    if (!this.ready) {
      return;
    }
    await this.embeddingRepo.delete({ agentId });
  }
}
