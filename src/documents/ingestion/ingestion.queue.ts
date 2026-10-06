import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

/**
 * Contrato da fila de ingestão. A implementação in-process abaixo pode ser
 * substituída por uma fila externa (Service Bus, BullMQ) implementando esta
 * mesma interface — o processamento continua em IngestionService.process(documentId).
 */
export interface IngestionQueue {
  enqueue(documentId: string): void;
}

export const INGESTION_QUEUE = 'INGESTION_QUEUE';

@Injectable()
export class InProcessIngestionQueue
  implements IngestionQueue, OnApplicationBootstrap
{
  private readonly logger = new Logger(InProcessIngestionQueue.name);
  private readonly queue: string[] = [];
  private draining = false;

  constructor(private readonly ingestionService: IngestionService) {}

  async onApplicationBootstrap(): Promise<void> {
    const interrupted = await this.ingestionService.failInterrupted();
    if (interrupted > 0) {
      this.logger.warn(
        `${interrupted} documento(s) interrompidos por restart marcados como failed`,
      );
    }
    const pending = await this.ingestionService.findPendingDocumentIds();
    for (const documentId of pending) {
      this.logger.log(`Reenfileirando documento pendente ${documentId}`);
      this.enqueue(documentId);
    }
  }

  enqueue(documentId: string): void {
    this.queue.push(documentId);
    this.logger.log(
      `Documento ${documentId} enfileirado (${this.queue.length} na fila)`,
    );
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const documentId = this.queue.shift() as string;
        try {
          await this.ingestionService.process(documentId);
        } catch (error) {
          this.logger.error(
            `Erro não tratado ao processar documento ${documentId}: ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
