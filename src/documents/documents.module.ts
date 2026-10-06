import {
  INGESTION_QUEUE,
  InProcessIngestionQueue,
} from './ingestion/ingestion.queue';

import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentEventsService } from './document-events.service';
import { DocumentChunk } from './entities/document-chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { IngestionService } from './ingestion/ingestion.service';
import { RagModule } from '../rag/rag.module';
import { ServiceBusIngestionQueue } from './ingestion/service-bus-ingestion.queue';
import { StorageModule } from '../storage/storage.module';
import { TextExtractorService } from './extraction/text-extractor.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, DocumentChunk]),
    StorageModule,
    EmbeddingsModule,
    RagModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    IngestionService,
    TextExtractorService,
    DocumentEventsService,
    {
      provide: INGESTION_QUEUE,
      useFactory: (
        ingestionService: IngestionService,
        configService: ConfigService,
      ) => {
        const connectionString = configService.get<string>(
          'AZURE_SERVICE_BUS_CONNECTION_STRING',
          '',
        );
        if (connectionString) {
          return new ServiceBusIngestionQueue(ingestionService, configService);
        }
        new Logger('DocumentsModule').warn(
          'AZURE_SERVICE_BUS_CONNECTION_STRING ausente — usando fila in-process',
        );
        return new InProcessIngestionQueue(ingestionService);
      },
      inject: [IngestionService, ConfigService],
    },
  ],
  exports: [DocumentsService, IngestionService, TextExtractorService],
})
export class DocumentsModule {}
