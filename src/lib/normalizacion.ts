// Utils para normalización extrema de textos pre-conciliación según estándares ERP
export function normalizarTextoEstricto(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFKD') // Descomponer caracteres
    .replace(/[\u0300-\u036f]/g, '') // Quitar diacríticos/acentos
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ') // Quitar puntuación
    .replace(/\s+/g, ' ') // Colapsar múltiples espacios
    .trim();
}

/** 
 * Elimina sufijos societarios típicos españoles para comparación limpia 
 * de nombres de proveedores/clientes.
 */
export function limpiarRuidoSocietario(textoNormalizado: string): string {
  if (!textoNormalizado) return '';
  // Se asume que el texto ya está en minúsculas y sin puntuación
  const stopwords = [
    ' s a', ' sa', ' s l', ' sl', ' s l u', ' slu', ' s l p', ' slp',
    ' s a u', ' sau', ' s l l', ' sll', ' s c u d', ' scud', ' scp', ' s c p',
    ' sociedad', ' anonima', ' limitada', ' unipersonal', ' profesional'
  ];

  let limpio = textoNormalizado;
  // Repetir un par de veces por si hay combinaciones como "sociedad anonima" -> "anonima" -> ""
  for (let i = 0; i < 2; i++) {
    for (const stopword of stopwords) {
      if (limpio.endsWith(stopword)) {
        limpio = limpio.slice(0, -stopword.length).trim();
      }
    }
  }

  return limpio;
}

/**
 * Normalización completa para comparar nombres.
 */
export function obtenerFirmaContrapartida(nombre: string | null | undefined): string {
  if (!nombre) return '';
  return limpiarRuidoSocietario(normalizarTextoEstricto(nombre));
}

// ----------------------------------------------------
// ISO 11649: Extractor de Referencia RF Bancaria
// ----------------------------------------------------

/**
 * Busca y valida una "Creditor Reference" ISO 11649 (Empezando con RF)
 * dentro de un texto crudo bancario. Devuelve el RF válido, o null.
 */
export function extraerYValidarISO11649(textoBruto: string | null | undefined): string | null {
  if (!textoBruto) return null;

  // Buscar secuencias que empiecen por RF, seguidas de 2 dígitos y hasta 21 alfanuméricos
  // Puede contener espacios o guiones según se imprima en facturas, los ignoramos dentro
  const candidates = textoBruto.toUpperCase().match(/RF[0-9]{2}[A-Z0-9 -]{1,25}/g);
  
  if (!candidates) return null;

  for (let rawCand of candidates) {
    // Limpiar separadores visuales
    const cand = rawCand.replace(/[ -]/g, '');
    
    // Condición básica 11649: longitud entre 5 y 25
    if (cand.length >= 5 && cand.length <= 25) {
      if (validarModulo97ISO11649(cand)) {
        return cand;
      }
    }
  }

  return null;
}

/**
 * Lógica del checksum Modulo 97-10 para ISO 11649
 */
function validarModulo97ISO11649(rfString: string): boolean {
  // 1. Mover los 4 primeros caracteres al final
  const rearanged = rfString.substring(4) + rfString.substring(0, 4);
  
  // 2. Convertir letras a números (A=10, B=11 ... Z=35)
  let numericString = '';
  for (let i = 0; i < rearanged.length; i++) {
    const charCode = rearanged.charCodeAt(i);
    // Letras A-Z
    if (charCode >= 65 && charCode <= 90) {
      numericString += (charCode - 55).toString();
    } else {
      numericString += rearanged[i];
    }
  }

  // 3. Math modulo 97 sobre números grandes en string
  return modulo97(numericString) === 1;
}

/** Helper para modulo sobre strings gigantes */
function modulo97(numericString: string): number {
  let checksum = numericString.substring(0, 9);
  let ix = 9;

  let remainder = parseInt(checksum, 10) % 97;

  while (ix < numericString.length) {
    const nextSlice = numericString.substring(ix, ix + 7);
    checksum = remainder.toString() + nextSlice;
    remainder = parseInt(checksum, 10) % 97;
    ix += 7;
  }
  return remainder;
}

// Helper para extraer un token hash de deduplicación de movimientos
export function generarHashTransaccion(fecha: string, concepto: string, importe: number): string {
  // Combinamos fecha, concepto normalizado y el importe preciso
  return `${fecha}_${normalizarTextoEstricto(concepto)}_${importe.toFixed(2)}`;
}
