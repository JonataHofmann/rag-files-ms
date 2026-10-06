import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EmbeddingProvider } from '../embeddings/types/embedding-provider.interface';
import { EMBEDDING_PROVIDER } from '../embeddings/types/embedding-provider.interface';
import {
  SearchRequestDto,
  SearchResponseDto,
  SearchResultItemDto,
} from './dto/search.dto';
import { VectorStoreService } from './vector-store.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async search(dto: SearchRequestDto): Promise<SearchResponseDto> {
    const startedAt = Date.now();
    this.logger.log(
      `[RAG-MS] 2/4 gerando embedding da query | agent=${dto.agentId} query="${dto.query.slice(0, 80)}"`,
    );
    const [vector] = await this.embeddingProvider.embed([dto.query]);
    this.logger.log(
      `[RAG-MS] embedding pronto | agent=${dto.agentId} dim=${vector?.length ?? 0} ${Date.now() - startedAt}ms`,
    );

    const hits = await this.vectorStoreService.search(vector, {
      agentId: dto.agentId,
      userId: dto.userId,
      documentId: dto.documentId,
      threadId: dto.threadId,
      limit: dto.limit,
    });

    const minScore = dto.minScore ?? 0;
    const asString = (value: unknown): string =>
      typeof value === 'string' ? value : '';
    const results: SearchResultItemDto[] = hits
      .filter((hit) => hit.score >= minScore)
      .map((hit) => ({
        chunkId: hit.chunkId,
        score: hit.score,
        documentId: asString(hit.payload.documentId),
        filename: asString(hit.payload.filename),
        page: (hit.payload.page as number | null) ?? null,
        chunkIndex: Number(hit.payload.chunkIndex ?? 0),
        text: asString(hit.payload.text),
        metadata: (hit.payload.metadata as Record<string, unknown>) ?? {},
      }));

    const topScore = hits[0]?.score;
    this.logger.log(
      `[RAG-MS] 4/4 resultado | agent=${dto.agentId} hits=${hits.length} retornados=${results.length} minScore=${minScore} topScore=${topScore != null ? topScore.toFixed(3) : '-'} ${Date.now() - startedAt}ms`,
    );
    return { results, total: results.length };
  }
}
