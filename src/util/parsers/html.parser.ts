import { PageText } from '../chunker';
import { convert } from 'html-to-text';

export function parseHtml(buffer: Buffer): PageText[] {
  const text = convert(buffer.toString('utf8'), {
    wordwrap: false,
    selectors: [
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
    ],
  });
  return [{ page: null, text }];
}
