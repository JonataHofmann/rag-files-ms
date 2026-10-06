import { PDFParse } from 'pdf-parse';
import { PageText } from '../chunker';

export async function parsePdf(buffer: Buffer): Promise<PageText[]> {
  let doc: PDFParse | undefined;
  try {
    doc = new PDFParse({
      data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    });
    const result = await doc.getText();
    return result.pages.map((page) => ({
      page: page.num,
      text: page.text ?? '',
    }));
  } catch (error) {
    throw new Error(
      `Falha ao processar PDF: ${(error as Error).message ?? 'arquivo inválido ou corrompido'}`,
    );
  } finally {
    await doc?.destroy();
  }
}
