import { PageText } from '../chunker';
import { parse } from 'csv-parse/sync';

/**
 * Converte cada linha em "coluna: valor" para que o contexto do cabeçalho
 * seja preservado dentro de cada chunk.
 */
export function parseCsv(buffer: Buffer): PageText[] {
  const raw = buffer.toString('utf8');
  try {
    const parsed: unknown = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
    const rows = parsed as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return [{ page: null, text: raw }];
    }
    const text = rows
      .map((row, i) => {
        const fields = Object.entries(row)
          .map(([column, value]) => `${column}: ${String(value)}`)
          .join('; ');
        return `Linha ${i + 1} — ${fields}`;
      })
      .join('\n');
    return [{ page: null, text }];
  } catch {
    return [{ page: null, text: raw }];
  }
}
