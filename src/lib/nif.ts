/**
 * Normaliza un NIF/CIF español al formato estándar CON guión entre letra y números.
 * Ejemplos: "B44650307" → "B-44650307" | "12345678A" → "12345678-A"
 */
export function normalizarNIF(nif: string): string {
  const raw = nif.toUpperCase().replace(/[\s-]/g, '');
  if (/^[A-Z]\d+$/.test(raw)) return `${raw[0]}-${raw.slice(1)}`;
  if (/^\d+[A-Z]$/.test(raw)) return `${raw.slice(0, -1)}-${raw.slice(-1)}`;
  return raw;
}

/** Devuelve el NIF sin ningún guión (para búsquedas flexibles) */
export function nifRaw(nif: string): string {
  return nif.toUpperCase().replace(/[\s-]/g, '');
}
