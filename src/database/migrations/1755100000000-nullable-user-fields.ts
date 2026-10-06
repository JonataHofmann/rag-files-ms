import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableUserFields1755100000000 implements MigrationInterface {
  name = 'NullableUserFields1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "threadId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "messageId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ALTER COLUMN "userId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "threadId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "messageId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ALTER COLUMN "userId" SET NOT NULL`,
    );
  }
}
