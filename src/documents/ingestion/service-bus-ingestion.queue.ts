import {
  ProcessErrorArgs,
  ServiceBusClient,
  ServiceBusReceivedMessage,
  ServiceBusReceiver,
  ServiceBusSender,
} from '@azure/service-bus';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { IngestionQueue } from './ingestion.queue';
import { IngestionService } from './ingestion.service';

const MAX_AUTO_LOCK_RENEWAL_MS = 30 * 60 * 1000;

@Injectable()
export class ServiceBusIngestionQueue
  implements IngestionQueue, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ServiceBusIngestionQueue.name);
  private readonly client: ServiceBusClient;
  private readonly sender: ServiceBusSender;
  private readonly receiver: ServiceBusReceiver;
  private readonly queueName: string;

  constructor(
    private readonly ingestionService: IngestionService,
    configService: ConfigService,
  ) {
    const connectionString = configService.get<string>(
      'AZURE_SERVICE_BUS_CONNECTION_STRING',
      '',
    );
    this.queueName = configService.get<string>(
      'AZURE_SERVICE_BUS_QUEUE_NAME',
      'ingestion-jobs',
    );
    this.client = new ServiceBusClient(connectionString);
    this.sender = this.client.createSender(this.queueName);
    this.receiver = this.client.createReceiver(this.queueName, {
      receiveMode: 'peekLock',
      // maxAutoLockRenewalDurationInMs: MAX_AUTO_LOCK_RENEWAL_MS,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    const interrupted = await this.ingestionService.failInterrupted();
    if (interrupted > 0) {
      this.logger.warn(
        `${interrupted} documento(s) interrompidos por restart marcados como failed`,
      );
    }

    this.receiver.subscribe(
      {
        processMessage: (message) => this.handleMessage(message),
        processError: (args) => this.handleError(args),
      },
      {
        maxConcurrentCalls: 1,
        autoCompleteMessages: false,
      },
    );
    this.logger.log(
      `Consumindo fila Service Bus "${this.queueName}" (peekLock, concorrência 1)`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.receiver.close();
    await this.sender.close();
    await this.client.close();
    this.logger.log('Conexões com Service Bus encerradas');
  }

  enqueue(documentId: string): void {
    void this.sender
      .sendMessages({ body: { documentId } })
      .then(() => {
        this.logger.log(
          `Documento ${documentId} enfileirado na fila "${this.queueName}"`,
        );
      })
      .catch((error: Error) => {
        this.logger.error(
          `Falha ao enfileirar documento ${documentId} no Service Bus: ${error.message}`,
        );
      });
  }

  private async handleMessage(
    message: ServiceBusReceivedMessage,
  ): Promise<void> {
    const documentId = (message.body as { documentId?: string })?.documentId;
    if (!documentId) {
      this.logger.warn(
        'Mensagem sem documentId — enviando para dead-letter queue',
      );
      await this.receiver.deadLetterMessage(message, {
        deadLetterReason: 'InvalidPayload',
        deadLetterErrorDescription: 'Mensagem sem documentId no body',
      });
      return;
    }
    try {
      await this.ingestionService.process(documentId);
      await this.receiver.completeMessage(message);
    } catch (error) {
      this.logger.error(
        `Erro ao processar documento ${documentId}: ${(error as Error).message} — abandonando mensagem para retry`,
      );
      await this.receiver.abandonMessage(message);
    }
  }

  private handleError(args: ProcessErrorArgs): Promise<void> {
    this.logger.error(
      `Erro no receiver do Service Bus (${args.errorSource}): ${args.error.message}`,
    );
    return Promise.resolve();
  }
}
