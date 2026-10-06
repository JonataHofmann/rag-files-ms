import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', index: true, nullable: true } as any)
  userId!: string | null;

  @Column({ type: 'varchar', index: true, nullable: true } as any)
  threadId!: string | null;

  @Column({ type: 'varchar', index: true, nullable: true } as any)
  messageId!: string | null;

  @Column({ type: 'varchar', index: true } as any)
  agentId!: string;

  @Column({ type: 'varchar' } as any)
  filename!: string;

  @Column({ type: 'varchar' } as any)
  originalName!: string;

  @Column({ type: 'varchar' } as any)
  mimeType!: string;

  @Column({ type: 'int' } as any)
  size!: number;

  @Column({ type: 'varchar' } as any)
  blobName!: string;

  @Column({ type: 'varchar' } as any)
  blobUrl!: string;

  @Column({
    type: 'varchar',
    default: DocumentStatusEnum.Uploaded,
    index: true,
  } as any)
  status!: DocumentStatusEnum;

  @Column({ type: 'varchar', nullable: true, default: null } as any)
  error!: string | null;

  @Column({ type: 'int', default: 0 } as any)
  chunkCount!: number;

  @Column({ type: 'int', nullable: true, default: null } as any)
  pageCount!: number | null;

  @Column({ type: 'jsonb', default: {} } as any)
  metadata!: Record<string, unknown>;

  @Column({
    type: 'varchar',
    default: FileTypeEnum.SYSTEM,
    index: true,
  } as any)
  type!: FileTypeEnum;

  @Column({ type: 'int' } as any)
  chunkSize!: number;

  @Column({ type: 'int' } as any)
  chunkOverlap!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
