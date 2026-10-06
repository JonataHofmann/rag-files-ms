import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentIdVarchar1755200000000 implements MigrationInterface {
  name = 'AgentIdVarchar1755200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ALTER COLUMN "agentId" TYPE varchar USING "agentId"::varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "chunk_embeddings" ALTER COLUMN "agentId" TYPE varchar USING "agentId"::varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ALTER COLUMN "agentId" TYPE uuid USING "agentId"::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "chunk_embeddings" ALTER COLUMN "agentId" TYPE uuid USING "agentId"::uuid`,
    );
  }
}
