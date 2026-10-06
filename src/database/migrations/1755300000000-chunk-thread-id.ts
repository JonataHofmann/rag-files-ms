import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChunkThreadId1755300000000 implements MigrationInterface {
  name = 'ChunkThreadId1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chunk_embeddings" ADD COLUMN "threadId" varchar`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chunk_embeddings_threadId" ON "chunk_embeddings" ("threadId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_chunk_embeddings_threadId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chunk_embeddings" DROP COLUMN "threadId"`,
    );
  }
}
