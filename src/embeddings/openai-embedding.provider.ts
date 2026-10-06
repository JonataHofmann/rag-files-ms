import { OpenAIEmbeddings } from '@langchain/openai';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './types/embedding-provider.interface';

const BATCH_SIZE = 100;

@Injectable()
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenAIEmbeddingProvider.name);
  private readonly client: OpenAIEmbeddings | null;
  readonly model: string;
  readonly dimensions: number;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('OPENAI_API_KEY', '');
    this.model = configService.get<string>(
      'EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
    this.dimensions = configService.get<number>('EMBEDDING_DIMENSIONS', 1536);
    this.client = apiKey
      ? new OpenAIEmbeddings({ apiKey, model: this.model })
      : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY ausente — ingestão e busca vetorial ficarão indisponíveis',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Provider de embeddings não configurado (defina OPENAI_API_KEY no backend)',
      );
    }
    if (texts.length === 0) {
      return [];
    }
    this.logger.log(
      `Gerando embeddings para ${texts.length} textos (modelo ${this.model})`,
    );
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchVectors = await this.client.embedDocuments(batch);
      vectors.push(...batchVectors);
    }
    return vectors;
  }
}
