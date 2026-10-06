import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIEmbeddingProvider } from './openai-embedding.provider';

const embedDocuments = jest.fn();

jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({ embedDocuments })),
}));

function configStub(values: Record<string, unknown>) {
  return {
    get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
  };
}

async function buildProvider(
  values: Record<string, unknown>,
): Promise<OpenAIEmbeddingProvider> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      OpenAIEmbeddingProvider,
      { provide: ConfigService, useValue: configStub(values) },
    ],
  }).compile();
  return module.get(OpenAIEmbeddingProvider);
}

describe('OpenAIEmbeddingProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expõe modelo e dimensões do ambiente', async () => {
    const provider = await buildProvider({
      OPENAI_API_KEY: 'test-key',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      EMBEDDING_DIMENSIONS: 1536,
    });

    expect(provider.model).toBe('text-embedding-3-small');
    expect(provider.dimensions).toBe(1536);
    expect(provider.isConfigured()).toBe(true);
  });

  it('divide em lotes de até 100 preservando a ordem', async () => {
    const provider = await buildProvider({ OPENAI_API_KEY: 'test-key' });
    const texts = Array.from({ length: 150 }, (_, i) => `texto-${i}`);
    embedDocuments.mockImplementation((batch: string[]) =>
      Promise.resolve(batch.map((text) => [Number(text.split('-')[1])])),
    );

    const vectors = await provider.embed(texts);

    expect(embedDocuments).toHaveBeenCalledTimes(2);
    expect(embedDocuments.mock.calls[0][0]).toHaveLength(100);
    expect(embedDocuments.mock.calls[1][0]).toHaveLength(50);
    expect(vectors).toHaveLength(150);
    expect(vectors[0]).toEqual([0]);
    expect(vectors[149]).toEqual([149]);
  });

  it('retorna lista vazia sem chamar a API para entrada vazia', async () => {
    const provider = await buildProvider({ OPENAI_API_KEY: 'test-key' });

    await expect(provider.embed([])).resolves.toEqual([]);
    expect(embedDocuments).not.toHaveBeenCalled();
  });

  it('sem API key: isConfigured é false e embed falha com erro claro', async () => {
    const provider = await buildProvider({});

    expect(provider.isConfigured()).toBe(false);
    await expect(provider.embed(['a'])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
