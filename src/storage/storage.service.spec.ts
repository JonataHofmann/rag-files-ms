import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

const uploadData = jest.fn();
const downloadToBuffer = jest.fn();
const deleteIfExists = jest.fn();
const exists = jest.fn();
const createIfNotExists = jest.fn();
const getProperties = jest.fn();
const getBlockBlobClient = jest.fn(() => ({
  url: 'http://127.0.0.1:10000/devstoreaccount1/documents/user/doc/file.txt',
  uploadData,
  downloadToBuffer,
  deleteIfExists,
  exists,
  getProperties,
}));

const mockGenerateBlobSASQueryParameters = jest.fn(() => ({
  toString: () => 'sastoken',
}));

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn(() => ({
      getContainerClient: jest.fn(() => ({
        containerName: 'documents',
        createIfNotExists,
        exists,
        getBlockBlobClient,
      })),
    })),
  },
  StorageSharedKeyCredential: jest.fn(),
  generateBlobSASQueryParameters: () => mockGenerateBlobSASQueryParameters(),
  BlobSASPermissions: {
    parse: jest.fn(() => ({})),
  },
  SASProtocol: {
    HttpsAndHttp: 'https,http',
  },
}));

describe('StorageService', () => {
  let service: StorageService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('com account key (sharedKeyCredential set)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultValue?: string) => {
                const values: Record<string, string> = {
                  AZURE_STORAGE_ACCOUNT_KEY: 'dGVzdGtleQ==',
                  AZURE_STORAGE_ACCOUNT_NAME: 'testaccount',
                };
                return values[key] ?? defaultValue;
              },
            },
          },
        ],
      }).compile();
      service = module.get(StorageService);
    });

    it('cria o container no onModuleInit', async () => {
      await service.onModuleInit();
      expect(createIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('onModuleInit loga erro se createIfNotExists falha', async () => {
      createIfNotExists.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await service.onModuleInit();
      expect(createIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('faz upload com contentType e retorna blobName, url e size', async () => {
      const buffer = Buffer.from('conteúdo');
      const result = await service.upload(
        buffer,
        'user/doc/file.txt',
        'text/plain',
      );

      expect(getBlockBlobClient).toHaveBeenCalledWith('user/doc/file.txt');
      expect(uploadData).toHaveBeenCalledWith(buffer, {
        blobHTTPHeaders: { blobContentType: 'text/plain' },
      });
      expect(result).toEqual({
        blobName: 'user/doc/file.txt',
        url: 'http://127.0.0.1:10000/devstoreaccount1/documents/user/doc/file.txt',
        size: buffer.length,
      });
    });

    it('generateUploadUrl retorna signed URL com SAS token', () => {
      const result = service.generateUploadUrl(
        'user/doc/file.txt',
        'text/plain',
        1024,
      );

      expect(getBlockBlobClient).toHaveBeenCalledWith('user/doc/file.txt');
      expect(result.blobName).toBe('user/doc/file.txt');
      expect(result.signedUrl).toContain('sastoken');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('baixa o blob como Buffer', async () => {
      const expected = Buffer.from('dados');
      downloadToBuffer.mockResolvedValueOnce(expected);

      const result = await service.download('user/doc/file.txt');

      expect(getBlockBlobClient).toHaveBeenCalledWith('user/doc/file.txt');
      expect(result).toBe(expected);
    });

    it('exclui o blob com deleteIfExists', async () => {
      await service.delete('user/doc/file.txt');
      expect(deleteIfExists).toHaveBeenCalledTimes(1);
    });

    it('getProperties retorna null quando blob não existe', async () => {
      getProperties.mockRejectedValueOnce(new Error('Not Found'));

      const result = await service.getProperties('user/doc/file.txt');

      expect(result).toBeNull();
    });

    it('getProperties retorna propriedades quando blob existe', async () => {
      getProperties.mockResolvedValueOnce({
        contentLength: 1024,
        contentType: 'text/plain',
        etag: '"abc123"',
      });

      const result = await service.getProperties('user/doc/file.txt');

      expect(result).toEqual({
        size: 1024,
        contentType: 'text/plain',
        etag: '"abc123"',
      });
    });

    it('getProperties usa fallback quando propriedades são nulas', async () => {
      getProperties.mockResolvedValueOnce({
        contentLength: undefined,
        contentType: undefined,
        etag: undefined,
      });

      const result = await service.getProperties('user/doc/file.txt');

      expect(result).toEqual({
        size: 0,
        contentType: 'application/octet-stream',
        etag: '',
      });
    });

    it('exists retorna true quando blob existe', async () => {
      exists.mockResolvedValueOnce(true);

      const result = await service.exists('user/doc/file.txt');

      expect(result).toBe(true);
    });

    it('exists retorna false quando blob não existe (exceção)', async () => {
      exists.mockRejectedValueOnce(new Error('Not Found'));

      const result = await service.exists('user/doc/file.txt');

      expect(result).toBe(false);
    });

    it('healthCheck retorna true quando o container responde', async () => {
      exists.mockResolvedValueOnce(true);
      await expect(service.healthCheck()).resolves.toBe(true);
    });

    it('healthCheck retorna false quando o storage está indisponível', async () => {
      exists.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.healthCheck()).resolves.toBe(false);
    });
  });

  describe('sem account key (sharedKeyCredential null)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultValue?: string) => {
                const values: Record<string, string> = {
                  AZURE_STORAGE_ACCOUNT_KEY: '',
                  AZURE_STORAGE_ACCOUNT_NAME: 'testaccount',
                };
                return values[key] ?? defaultValue;
              },
            },
          },
        ],
      }).compile();
      service = module.get(StorageService);
    });

    it('generateUploadUrl retorna URL sem SAS quando sem credenciais', () => {
      const result = service.generateUploadUrl(
        'user/doc/file.txt',
        'text/plain',
        1024,
      );

      expect(result.signedUrl).toBe(
        'http://127.0.0.1:10000/devstoreaccount1/documents/user/doc/file.txt',
      );
      expect(result.blobName).toBe('user/doc/file.txt');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.signedUrl).not.toContain('?');
    });
  });

  describe('credenciais extraídas da connection string', () => {
    it('usa AccountName/AccountKey da connection string quando env vars ausentes', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultValue?: string) => {
                if (key === 'AZURE_STORAGE_CONNECTION_STRING') {
                  return 'DefaultEndpointsProtocol=https;AccountName=csaccount;AccountKey=Y3NrZXk=;EndpointSuffix=core.windows.net';
                }
                return defaultValue;
              },
            },
          },
        ],
      }).compile();
      service = module.get(StorageService);

      const result = service.generateUploadUrl(
        'user/doc/file.txt',
        'text/plain',
        1024,
      );

      expect(result.signedUrl).toContain('sastoken');
    });

    it('cai no fallback devstoreaccount1 sem key quando connection string não tem credenciais', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultValue?: string) => {
                if (key === 'AZURE_STORAGE_CONNECTION_STRING') {
                  return 'UseDevelopmentStorage=true';
                }
                return defaultValue;
              },
            },
          },
        ],
      }).compile();
      service = module.get(StorageService);

      const result = service.generateUploadUrl(
        'user/doc/file.txt',
        'text/plain',
        1024,
      );

      expect(result.signedUrl).not.toContain('sastoken');
    });
  });
});
