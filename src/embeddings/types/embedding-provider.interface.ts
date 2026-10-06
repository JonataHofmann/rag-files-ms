export interface EmbeddingProvider {
  readonly model: string;
  /** Dimensão dos vetores gerados (deve bater com a tabela pgvector chunk_vectors). */
  readonly dimensions: number;
  isConfigured(): boolean;
  /** Gera embeddings em lote, preservando a ordem dos textos de entrada. */
  embed(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER';
