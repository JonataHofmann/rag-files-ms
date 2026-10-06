export interface ChunkVectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorSearchFilter {
  agentId?: string;
  userId?: string;
  documentId?: string;
  threadId?: string;
  limit?: number;
}

export interface VectorSearchResult {
  chunkId: string;
  score: number;
  payload: Record<string, unknown>;
}
