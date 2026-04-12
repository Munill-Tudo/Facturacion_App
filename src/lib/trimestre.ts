export function getTrimestreFiscal(dateStr?: string | null): string | null {
  if (!dateStr) return null;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-T${q}`;
}
