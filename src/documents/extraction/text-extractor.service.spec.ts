import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TextExtractorService } from './text-extractor.service';

jest.mock('../../util/parsers/csv.parser', () => ({
  parseCsv: jest.fn(),
}));
jest.mock('../../util/parsers/docx.parser', () => ({
  parseDocx: jest.fn(),
}));
jest.mock('../../util/parsers/html.parser', () => ({
  parseHtml: jest.fn(),
}));
jest.mock('../../util/parsers/pdf.parser', () => ({
  parsePdf: jest.fn(),
}));
jest.mock('../../util/parsers/plain.parser', () => ({
  parsePlainText: jest.fn(),
  parseJson: jest.fn(),
}));

import { parseCsv } from '../../util/parsers/csv.parser';
import { parseDocx } from '../../util/parsers/docx.parser';
import { parseHtml } from '../../util/parsers/html.parser';
import { parsePdf } from '../../util/parsers/pdf.parser';
import { parsePlainText, parseJson } from '../../util/parsers/plain.parser';

describe('TextExtractorService', () => {
  let service: TextExtractorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextExtractorService],
    }).compile();
    service = module.get(TextExtractorService);
  });

  describe('isSupported', () => {
    const supported: Array<[string, string, string]> = [
      ['pdf', 'file.pdf', 'application/pdf'],
      [
        'docx',
        'file.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      ['txt', 'file.txt', 'text/plain'],
      ['md', 'file.md', 'text/markdown'],
      ['md', 'file.markdown', 'text/markdown'],
      ['csv', 'file.csv', 'text/csv'],
      ['html', 'file.html', 'text/html'],
      ['html', 'file.htm', 'text/html'],
      ['json', 'file.json', 'application/json'],
    ];

    it.each(supported)('retorna true para %s', (_, name, mime) => {
      expect(service.isSupported(name, mime)).toBe(true);
    });

    it('retorna false para tipo não suportado', () => {
      expect(service.isSupported('file.exe', 'application/x-msdownload')).toBe(
        false,
      );
    });

    it('retorna false quando extensão e mime são desconhecidos', () => {
      expect(service.isSupported('file.xyz', 'application/octet-stream')).toBe(
        false,
      );
    });
  });

  describe('resolveType', () => {
    it('resolve pela extensão quando disponível', () => {
      expect(service.resolveType('file.pdf', '')).toBe('pdf');
      expect(service.resolveType('file.docx', '')).toBe('docx');
      expect(service.resolveType('file.txt', '')).toBe('txt');
      expect(service.resolveType('file.md', '')).toBe('md');
      expect(service.resolveType('file.markdown', '')).toBe('md');
      expect(service.resolveType('file.csv', '')).toBe('csv');
      expect(service.resolveType('file.html', '')).toBe('html');
      expect(service.resolveType('file.htm', '')).toBe('html');
      expect(service.resolveType('file.json', '')).toBe('json');
    });

    it('resolve pelo mime type quando extensão desconhecida', () => {
      expect(service.resolveType('file.xyz', 'application/pdf')).toBe('pdf');
      expect(service.resolveType('file.xyz', 'text/csv')).toBe('csv');
      expect(service.resolveType('file.xyz', 'application/csv')).toBe('csv');
      expect(service.resolveType('file.xyz', 'text/markdown')).toBe('md');
    });

    it('retorna null quando nem extensão nem mime são conhecidos', () => {
      expect(
        service.resolveType('file.xyz', 'application/octet-stream'),
      ).toBeNull();
    });

    it('retorna null para string vazia sem extensão', () => {
      expect(service.resolveType('file', '')).toBeNull();
    });
  });

  describe('extract', () => {
    it('lança BadRequestException para tipo não suportado', async () => {
      await expect(
        service.extract(
          Buffer.from(''),
          'file.exe',
          'application/x-msdownload',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('filtra páginas vazias após normalização', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: '  ' },
      ]);
      const result = await service.extract(
        Buffer.from('  '),
        'file.txt',
        'text/plain',
      );
      expect(result).toHaveLength(0);
    });

    it('extrai de pdf', async () => {
      (parsePdf as jest.Mock).mockResolvedValue([
        { page: 1, text: 'pdf content' },
      ]);
      const result = await service.extract(
        Buffer.from('pdf'),
        'file.pdf',
        'application/pdf',
      );
      expect(result).toEqual([{ page: 1, text: 'pdf content' }]);
    });

    it('extrai de docx', async () => {
      (parseDocx as jest.Mock).mockResolvedValue([
        { page: null, text: 'docx content' },
      ]);
      const result = await service.extract(
        Buffer.from('docx'),
        'file.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(result).toEqual([{ page: null, text: 'docx content' }]);
    });

    it('extrai de html', async () => {
      (parseHtml as jest.Mock).mockReturnValue([
        { page: null, text: 'html content' },
      ]);
      const result = await service.extract(
        Buffer.from('<p>html</p>'),
        'file.html',
        'text/html',
      );
      expect(result).toEqual([{ page: null, text: 'html content' }]);
    });

    it('extrai de csv', async () => {
      (parseCsv as jest.Mock).mockReturnValue([
        { page: null, text: 'csv content' },
      ]);
      const result = await service.extract(
        Buffer.from('a,b\n1,2'),
        'file.csv',
        'text/csv',
      );
      expect(result).toEqual([{ page: null, text: 'csv content' }]);
    });

    it('extrai de json', async () => {
      (parseJson as jest.Mock).mockReturnValue([
        { page: null, text: 'json content' },
      ]);
      const result = await service.extract(
        Buffer.from('{"a":1}'),
        'file.json',
        'application/json',
      );
      expect(result).toEqual([{ page: null, text: 'json content' }]);
    });

    it('extrai de txt', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: 'text content' },
      ]);
      const result = await service.extract(
        Buffer.from('text content'),
        'file.txt',
        'text/plain',
      );
      expect(result).toEqual([{ page: null, text: 'text content' }]);
    });

    it('extrai de md', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: 'md content' },
      ]);
      const result = await service.extract(
        Buffer.from('# md'),
        'file.md',
        'text/markdown',
      );
      expect(result).toEqual([{ page: null, text: 'md content' }]);
    });

    it('aplica normalize em cada página', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: '  hello\r\nworld  ' },
      ]);
      const result = await service.extract(
        Buffer.from('  hello\r\nworld  '),
        'file.txt',
        'text/plain',
      );
      expect(result).toEqual([{ page: null, text: 'hello\nworld' }]);
    });
  });

  describe('normalize (via extract)', () => {
    it('remove caracteres nulos', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: 'he\x00llo' },
      ]);
      const result = await service.extract(
        Buffer.from('he\x00llo'),
        'file.txt',
        'text/plain',
      );
      expect(result[0].text).toBe('hello');
    });

    it('normaliza quebras de linha CR+LF e CR', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: 'a\r\nb\rc' },
      ]);
      const result = await service.extract(
        Buffer.from('a\r\nb\rc'),
        'file.txt',
        'text/plain',
      );
      expect(result[0].text).toBe('a\nb\nc');
    });

    it('remove espaços/tabs antes de quebra de linha', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: 'a  \nb\t\nc' },
      ]);
      const result = await service.extract(
        Buffer.from('a  \nb\t\nc'),
        'file.txt',
        'text/plain',
      );
      expect(result[0].text).toBe('a\nb\nc');
    });

    it('colapsa 3+ quebras em 2', async () => {
      (parsePlainText as jest.Mock).mockReturnValue([
        { page: null, text: 'a\n\n\n\nb' },
      ]);
      const result = await service.extract(
        Buffer.from('a\n\n\n\nb'),
        'file.txt',
        'text/plain',
      );
      expect(result[0].text).toBe('a\n\nb');
    });
  });
});
