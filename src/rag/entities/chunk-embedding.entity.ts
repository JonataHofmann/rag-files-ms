import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('chunk_embeddings')
export class ChunkEmbedding {
  @PrimaryColumn('uuid')
  chunkId!: string;

  @Column({ type: 'uuid' })
  documentId!: string;

  @Column({ type: 'varchar' })
  agentId!: string;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @Index('IDX_chunk_embeddings_threadId')
  @Column({ type: 'varchar', nullable: true })
  threadId!: string | null;

  @Column({
    type: 'vector',
    length: 1536,
    nullable: true,
  })
  embedding!: number[];

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
