import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from '@azure/storage-blob';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignedUrl, UploadedBlob } from './types/storage.types';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly containerClient: ContainerClient;
  private readonly sharedKeyCredential: StorageSharedKeyCredential | null;
  private readonly accountName: string;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'AZURE_STORAGE_CONNECTION_STRING',
      'UseDevelopmentStorage=true',
    );
    const containerName = this.configService.get<string>(
      'AZURE_STORAGE_CONTAINER',
      'documents',
    );
    this.accountName =
      this.configService.get<string>('AZURE_STORAGE_ACCOUNT_NAME', '') ||
      (/AccountName=([^;]+)/.exec(connectionString)?.[1] ?? 'devstoreaccount1');
    const accountKey =
      this.configService.get<string>('AZURE_STORAGE_ACCOUNT_KEY', '') ||
      (/AccountKey=([^;]+)/.exec(connectionString)?.[1] ?? '');
    this.containerClient =
      BlobServiceClient.fromConnectionString(
        connectionString,
      ).getContainerClient(containerName);

    this.sharedKeyCredential = accountKey
      ? new StorageSharedKeyCredential(this.accountName, accountKey)
      : null;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.containerClient.createIfNotExists();
      this.logger.log(
        `Container "${this.containerClient.containerName}" disponível`,
      );
    } catch (error) {
      this.logger.error(
        `Não foi possível garantir o container "${this.containerClient.containerName}": ${(error as Error).message}`,
      );
    }
  }

  async upload(
    buffer: Buffer,
    blobName: string,
    contentType: string,
  ): Promise<UploadedBlob> {
    this.logger.log(`Enviando blob "${blobName}" (${buffer.length} bytes)`);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    this.logger.log(`Blob "${blobName}" enviado`);
    return {
      blobName,
      url: blockBlobClient.url,
      size: buffer.length,
    };
  }

  generateUploadUrl(
    blobName: string,
    contentType: string,
    size: number,
  ): SignedUrl {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    let signedUrl: string;

    if (this.sharedKeyCredential) {
      const expiresOn = new Date(new Date().valueOf() + 1000 * 60 * 60);
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerClient.containerName,
          blobName,
          permissions: BlobSASPermissions.parse('cw'),
          startsOn: new Date(),
          expiresOn,
          protocol: SASProtocol.HttpsAndHttp,
          contentType,
        },
        this.sharedKeyCredential,
      ).toString();
      signedUrl = `${blockBlobClient.url}?${sasToken}`;
      return { signedUrl, blobName, expiresAt: expiresOn };
    }

    signedUrl = blockBlobClient.url;
    this.logger.warn(
      `Sem credenciais compartilhadas — retornando URL sem SAS para "${blobName}"`,
    );
    return {
      signedUrl,
      blobName,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    };
  }

  async exists(blobName: string): Promise<boolean> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      return await blockBlobClient.exists();
    } catch {
      return false;
    }
  }

  async getProperties(blobName: string): Promise<{
    size: number;
    contentType: string;
    etag: string;
  } | null> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      const props = await blockBlobClient.getProperties();
      return {
        size: props.contentLength ?? 0,
        contentType: props.contentType ?? 'application/octet-stream',
        etag: props.etag ?? '',
      };
    } catch {
      return null;
    }
  }

  async download(blobName: string): Promise<Buffer> {
    this.logger.log(`Baixando blob "${blobName}"`);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.downloadToBuffer();
  }

  async delete(blobName: string): Promise<void> {
    this.logger.log(`Excluindo blob "${blobName}"`);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.containerClient.exists();
      return true;
    } catch {
      return false;
    }
  }
}
