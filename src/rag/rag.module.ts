import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { ChunkEmbedding } from './entities/chunk-embedding.entity';
import { RagController } from './rag.controller';
import { SearchService } from './search.service';
import { VectorStoreService } from './vector-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChunkEmbedding]), EmbeddingsModule],
  controllers: [RagController],
  providers: [VectorStoreService, SearchService],
  exports: [VectorStoreService, SearchService],
})
export class RagModule {}
