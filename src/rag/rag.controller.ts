import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('rag')
@Controller('rag')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(private readonly searchService: SearchService) {}

  @Post('search')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Busca semântica nos chunks indexados (pgvector, cosine)',
  })
  @ApiBody({ type: SearchRequestDto })
  @ApiOkResponse({ type: SearchResponseDto })
  async search(@Body() dto: SearchRequestDto): Promise<SearchResponseDto> {
    this.logger.log(
      `[RAG-MS] 1/4 POST /rag/search recebido | agent=${dto.agentId} user=${dto.userId ?? '-'} doc=${dto.documentId ?? '-'} limit=${dto.limit ?? 8} minScore=${dto.minScore ?? 'default'} query="${dto.query?.slice(0, 80) ?? ''}"`,
    );
    return this.searchService.search(dto);
  }
}
