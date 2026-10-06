import { MigrationInterface, QueryRunner } from 'typeorm';

const EMBEDDING_DIMENSIONS = 1536;

export class InitialSchema1755000000000 implements MigrationInterface {
  name = 'InitialSchema1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" varchar NOT NULL,
        "threadId" varchar NOT NULL,
        "messageId" varchar NOT NULL,
        "agentId" varchar NOT NULL,
        "filename" varchar NOT NULL,
        "originalName" varchar NOT NULL,
        "mimeType" varchar NOT NULL,
        "size" int NOT NULL,
        "blobName" varchar NOT NULL,
        "blobUrl" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'uploaded',
        "error" varchar,
        "chunkCount" int NOT NULL DEFAULT 0,
        "pageCount" int,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "type" varchar NOT NULL DEFAULT 'system',
        "chunkSize" int NOT NULL,
        "chunkOverlap" int NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_documents_userId" ON "documents" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_documents_threadId" ON "documents" ("threadId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_documents_messageId" ON "documents" ("messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_documents_agentId" ON "documents" ("agentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_documents_status" ON "documents" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_documents_type" ON "documents" ("type")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "documentId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "userId" varchar NOT NULL,
        "chunkId" uuid NOT NULL UNIQUE,
        "chunkIndex" int NOT NULL,
        "page" int,
        "text" text NOT NULL,
        "tokenEstimate" int NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_document_chunks_documentId" ON "document_chunks" ("documentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_document_chunks_agentId" ON "document_chunks" ("agentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_document_chunks_userId" ON "document_chunks" ("userId")`,
    );

    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chunk_embeddings" (
        "chunkId" uuid PRIMARY KEY,
        "documentId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "userId" varchar,
        "embedding" vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chunk_embeddings_document" ON "chunk_embeddings" ("documentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chunk_embeddings_agent" ON "chunk_embeddings" ("agentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chunk_embeddings_embedding" ON "chunk_embeddings"
       USING hnsw ("embedding" vector_cosine_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chunk_embeddings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_chunks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
  }
}
