import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { DocumentEntity } from '../entities/document.entity';
import { DocumentConverter } from './document.converter';

describe('DocumentConverter', () => {
  const now = new Date('2025-01-01T00:00:00Z');
  const entity: DocumentEntity = {
    id: 'doc-1',
    userId: 'user-1',
    agentId: 'agent-1',
    threadId: 'thread-1',
    filename: 'file.txt',
    originalName: 'file.txt',
    mimeType: 'text/plain',
    size: 100,
    status: DocumentStatusEnum.Processed,
    error: null,
    chunkCount: 5,
    pageCount: 2,
    createdAt: now,
    updatedAt: now,
  } as DocumentEntity;

  describe('toResponse', () => {
    it('mapeia entidade para DocumentResponseDto', () => {
      const result = DocumentConverter.toResponse(entity);
      expect(result).toEqual({
        id: 'doc-1',
        agentId: 'agent-1',
        threadId: 'thread-1',
        filename: 'file.txt',
        originalName: 'file.txt',
        mimeType: 'text/plain',
        size: 100,
        status: DocumentStatusEnum.Processed,
        error: null,
        chunkCount: 5,
        pageCount: 2,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  describe('toStatusResponse', () => {
    it('mapeia entidade para DocumentStatusResponseDto', () => {
      const result = DocumentConverter.toStatusResponse(entity);
      expect(result).toEqual({
        documentId: 'doc-1',
        status: DocumentStatusEnum.Processed,
        error: null,
        chunkCount: 5,
        pageCount: 2,
        updatedAt: now,
      });
    });
  });
});
