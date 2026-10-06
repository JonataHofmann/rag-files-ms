import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', index: true } as any)
  documentId!: string;

  @Column({ type: 'varchar', index: true } as any)
  agentId!: string;

  @Column({ type: 'varchar', index: true, nullable: true } as any)
  userId!: string | null;

  @Column({ type: 'uuid', unique: true } as any)
  chunkId!: string;

  @Column({ type: 'int' } as any)
  chunkIndex!: number;

  @Column({ type: 'int', nullable: true, default: null } as any)
  page!: number | null;

  @Column({ type: 'text' } as any)
  text!: string;

  @Column({ type: 'int', default: 0 } as any)
  tokenEstimate!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
