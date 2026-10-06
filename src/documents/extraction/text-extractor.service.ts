import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseJson, parsePlainText } from '../../util/parsers/plain.parser';

import { PageText } from '../../util/chunker';
import { parseCsv } from '../../util/parsers/csv.parser';
import { parseDocx } from '../../util/parsers/docx.parser';
import { parseHtml } from '../../util/parsers/html.parser';
import { parsePdf } from '../../util/parsers/pdf.parser';

export type SupportedFileType =
  'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'html' | 'json';

const EXTENSION_MAP: Record<string, SupportedFileType> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  csv: 'csv',
  html: 'html',
  htm: 'html',
  json: 'json',
};

const MIME_MAP: Record<string, SupportedFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/html': 'html',
  'application/json': 'json',
};

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  resolveType(
    originalName: string,
    mimeType: string,
  ): SupportedFileType | null {
    const parts = originalName.split('.');
    const extension = parts[parts.length - 1].toLowerCase();
    return EXTENSION_MAP[extension] ?? MIME_MAP[mimeType] ?? null;
  }

  isSupported(originalName: string, mimeType: string): boolean {
    return this.resolveType(originalName, mimeType) !== null;
  }

  async extract(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<PageText[]> {
    const type = this.resolveType(originalName, mimeType);
    if (!type) {
      throw new BadRequestException(
        `Tipo de arquivo não suportado: "${originalName}" (${mimeType})`,
      );
    }
    this.logger.log(`Extraindo texto de "${originalName}" como ${type}`);
    const pages = await this.parse(buffer, type);
    return pages
      .map((page) => ({ ...page, text: this.normalize(page.text) }))
      .filter((page) => page.text.length > 0);
  }

  private parse(
    buffer: Buffer,
    type: SupportedFileType,
  ): Promise<PageText[]> | PageText[] {
    switch (type) {
      case 'pdf':
        return parsePdf(buffer);
      case 'docx':
        return parseDocx(buffer);
      case 'html':
        return parseHtml(buffer);
      case 'csv':
        return parseCsv(buffer);
      case 'json':
        return parseJson(buffer);
      case 'txt':
      case 'md':
        return parsePlainText(buffer);
    }
  }

  private normalize(text: string): string {
    return text
      .replace(/\0/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
