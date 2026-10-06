import * as mammoth from 'mammoth';

import { PageText } from '../chunker';

export async function parseDocx(buffer: Buffer): Promise<PageText[]> {
  const result = await mammoth.extractRawText({ buffer });
  return [{ page: null, text: result.value }];
}
