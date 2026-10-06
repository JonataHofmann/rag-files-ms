import { Module } from '@nestjs/common';
import { OpenAIEmbeddingProvider } from './openai-embedding.provider';
import { EMBEDDING_PROVIDER } from './types/embedding-provider.interface';

@Module({
  providers: [
    OpenAIEmbeddingProvider,
    { provide: EMBEDDING_PROVIDER, useExisting: OpenAIEmbeddingProvider },
  ],
  exports: [EMBEDDING_PROVIDER, OpenAIEmbeddingProvider],
})
export class EmbeddingsModule {}
