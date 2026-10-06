import { PageText } from '../chunker';

export function parsePlainText(buffer: Buffer): PageText[] {
  return [{ page: null, text: buffer.toString('utf8') }];
}

export function parseJson(buffer: Buffer): PageText[] {
  const raw = buffer.toString('utf8');
  try {
    return [{ page: null, text: JSON.stringify(JSON.parse(raw), null, 2) }];
  } catch {
    return [{ page: null, text: raw }];
  }
}
