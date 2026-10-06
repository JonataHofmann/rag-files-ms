import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export interface PageText {
  page: number | null;
  text: string;
}

export interface Chunk {
  text: string;
  index: number;
  page: number | null;
}

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

/**
 * Chunking inteligente sobre o RecursiveCharacterTextSplitter do LangChain.
 * Divide página por página para preservar a referência de página de cada chunk;
 * o índice do chunk é global ao documento.
 */
export class Chunker {
  async chunk(pages: PageText[], options: ChunkOptions): Promise<Chunk[]> {
    if (options.chunkOverlap >= options.chunkSize) {
      throw new Error('chunkOverlap deve ser menor que chunkSize');
    }
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      ...(options.separators ? { separators: options.separators } : {}),
    });

    const chunks: Chunk[] = [];
    let index = 0;
    for (const page of pages) {
      const text = page.text.trim();
      if (!text) {
        continue;
      }
      const pieces = await splitter.splitText(text);
      for (const piece of pieces) {
        chunks.push({ text: piece, index, page: page.page });
        index += 1;
      }
    }
    return chunks;
  }
}
