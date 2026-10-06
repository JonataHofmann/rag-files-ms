import { DocumentStatusResponseDto } from '../dto/job-status.response.dto';

import { DocumentResponseDto } from '../dto/document.response.dto';
import { DocumentEntity } from '../entities/document.entity';

export class DocumentConverter {
  static toResponse(entity: DocumentEntity): DocumentResponseDto {
    return {
      id: entity.id,
      agentId: entity.agentId,
      threadId: entity.threadId,
      filename: entity.filename,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      size: entity.size,
      status: entity.status,
      error: entity.error,
      chunkCount: entity.chunkCount,
      pageCount: entity.pageCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toStatusResponse(entity: DocumentEntity): DocumentStatusResponseDto {
    return {
      documentId: entity.id,
      status: entity.status,
      error: entity.error,
      chunkCount: entity.chunkCount,
      pageCount: entity.pageCount,
      updatedAt: entity.updatedAt,
    };
  }
}
