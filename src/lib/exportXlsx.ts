import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  /** Optional formatter — receives raw value, returns display string */
  format?: (value: any, row: any) => string;
}

/**
 * Exports an array of objects to an XLSX file and triggers download.
 * @param rows     Data to export (already filtered)
 * @param columns  Column definitions
 * @param filename File name (without extension)
 */
export function exportToXlsx(
  rows: any[],
  columns: ExportColumn[],
  filename: string,
) {
  // Build header row
  const headers = columns.map(c => c.header);

  // Build data rows
  const data = rows.map(row =>
    columns.map(col => {
      const raw = row[col.key];
      if (col.format) return col.format(raw, row);
      return raw ?? '';
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-fit column widths (approximate)
  ws['!cols'] = columns.map((col, idx) => {
    const maxLen = Math.max(
      col.header.length,
      ...data.map(r => String(r[idx] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
