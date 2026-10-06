import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentEventsService } from './document-events.service';
import { DocumentsService } from './documents.service';
import {
  ConfirmUploadBatchDto,
  ConfirmUploadBatchResponseDto,
} from './dto/confirm-upload-batch.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import {
  DocumentResponseDto,
  PaginatedDocumentsResponseDto,
} from './dto/document.response.dto';
import {
  InitUploadBatchDto,
  InitUploadBatchResponseDto,
} from './dto/init-upload-batch.dto';
import { InitUploadDto, InitUploadResponseDto } from './dto/init-upload.dto';
import { DocumentStatusResponseDto } from './dto/job-status.response.dto';
import { ListDocumentsQueryDto } from './dto/list-documents.query.dto';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentEvents: DocumentEventsService,
  ) {}

  @Sse('events')
  @ApiOperation({
    summary: 'Stream SSE de mudanças de status dos documentos',
  })
  @ApiQuery({ name: 'agentId', required: false })
  events(@Query('agentId') agentId?: string): Observable<MessageEvent> {
    this.logger.log(`SSE /documents/events agentId=${agentId ?? 'all'}`);
    return this.documentEvents
      .stream(agentId)
      .pipe(map((event) => ({ data: event })));
  }

  @Post('upload/init')
  @ApiOperation({
    summary:
      'Iniciar upload — retorna URL autoassinada para upload direto ao Azure Storage',
  })
  @ApiBody({ type: InitUploadDto })
  @ApiOkResponse({ type: InitUploadResponseDto })
  async initUpload(@Body() dto: InitUploadDto): Promise<InitUploadResponseDto> {
    this.logger.log(
      `POST /documents/upload/init file=${dto.originalName} agent=${dto.agentId} size=${dto.size} type=${dto.type}`,
    );
    console.log(dto);
    return this.documentsService.initUpload(
      dto.agentId,
      dto.type,
      dto.originalName,
      dto.mimeType,
      dto.size,
      dto.userId,
      dto.threadId,
      dto.messageId,
    );
  }

  @Post('upload/init/batch')
  @ApiOperation({
    summary:
      'Iniciar upload em lote — retorna URLs autoassinadas para múltiplos arquivos',
  })
  @ApiBody({ type: InitUploadBatchDto })
  @ApiOkResponse({ type: InitUploadBatchResponseDto })
  async initUploadBatch(
    @Body() dto: InitUploadBatchDto,
  ): Promise<InitUploadBatchResponseDto> {
    this.logger.log(
      `POST /documents/upload/init/batch files=${dto.files.length}`,
    );
    return this.documentsService.initUploadBatch(dto.files);
  }

  @Post('upload/confirm')
  @ApiOperation({
    summary:
      'Confirmar upload — cria documento após upload direto ao Azure Storage',
  })
  @ApiBody({ type: ConfirmUploadDto })
  @ApiOkResponse({ type: DocumentResponseDto })
  async confirmUpload(
    @Body() dto: ConfirmUploadDto,
  ): Promise<DocumentResponseDto> {
    this.logger.log(`POST /documents/upload/confirm blob=${dto.blobName}`);
    return this.documentsService.confirmUpload(
      dto.agentId,
      dto.type,
      dto.blobName,
      dto.originalName,
      dto.mimeType,
      Number(dto.size),
      dto.threadId,
      dto.messageId,
      dto.userId,
    );
  }

  @Post('upload/confirm/batch')
  @ApiOperation({
    summary:
      'Confirmar upload em lote — cria documentos após upload direto ao Azure Storage',
  })
  @ApiBody({ type: ConfirmUploadBatchDto })
  @ApiOkResponse({ type: ConfirmUploadBatchResponseDto })
  async confirmUploadBatch(
    @Body() dto: ConfirmUploadBatchDto,
  ): Promise<ConfirmUploadBatchResponseDto> {
    this.logger.log(
      `POST /documents/upload/confirm/batch files=${dto.files.length}`,
    );
    return this.documentsService.confirmUploadBatch(dto.files);
  }

  @Get()
  @ApiOperation({ summary: 'Listar documentos com busca, filtro e paginação' })
  @ApiOkResponse({ type: PaginatedDocumentsResponseDto })
  async list(
    @Query() query: ListDocumentsQueryDto,
  ): Promise<PaginatedDocumentsResponseDto> {
    this.logger.log(
      `GET /documents userId=${query.userId} threadId=${query.threadId ?? ''} search=${query.search ?? ''} status=${query.status ?? ''}`,
    );
    return this.documentsService.list(query.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar documento por id' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiOkResponse({ type: DocumentResponseDto })
  async getById(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<DocumentResponseDto> {
    this.assertUserId(userId);
    this.logger.log(`GET /documents/${id}`);
    return this.documentsService.getById(id, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Excluir documento (blob, chunks e vetores)' })
  @ApiQuery({ name: 'userId', required: true })
  async delete(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<void> {
    this.assertUserId(userId);
    this.logger.log(`DELETE /documents/${id}`);
    await this.documentsService.delete(id, userId);
  }

  // @Post(':id/reprocess')
  // @ApiOperation({ summary: 'Reprocessar documento (nova ingestão completa)' })
  // @ApiOkResponse({ type: DocumentStatusResponseDto })
  // async reprocess(
  //   @Param('id') id: string,
  //   @Query('userId') userId: string,
  // ): Promise<DocumentStatusResponseDto> {
  //   this.logger.log(`POST /documents/${id}/reprocess`);
  //   return this.documentsService.reprocess(id, userId);
  // }

  @Get(':id/status')
  @ApiOperation({ summary: 'Status de processamento do documento' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiOkResponse({ type: DocumentStatusResponseDto })
  async getStatus(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<DocumentStatusResponseDto> {
    this.assertUserId(userId);
    return this.documentsService.getStatus(id, userId);
  }

  private assertUserId(userId: string): void {
    if (!userId) {
      throw new BadRequestException('userId é obrigatório');
    }
  }
}
