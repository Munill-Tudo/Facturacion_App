import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { supabase } from '@/lib/supabase';

function parseYear(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return fallback;
  return parsed;
}

function parseQuarter(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return fallback;
  return parsed;
}

function getCurrentQuarter(date = new Date()) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function getQuarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: `${year}-T${quarter}`,
  };
}

function sanitizePart(value: string | number | null | undefined) {
  const clean = String(value ?? 'sin_valor')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'sin_valor';
}

function extractDriveId(url: string) {
  const patterns = [
    /\/file\/d\/([^/]+)/,
    /[?&]id=([^&]+)/,
    /\/d\/([^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function buildDriveDownloadUrl(url: string) {
  const id = extractDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function inferExtension(contentType: string | null, url: string) {
  if (contentType?.includes('pdf')) return '.pdf';
  if (contentType?.includes('zip')) return '.zip';
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('jpeg')) return '.jpg';
  if (contentType?.includes('jpg')) return '.jpg';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('json')) return '.json';
  if (contentType?.includes('xml')) return '.xml';

  const pathMatch = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  if (pathMatch?.[1]) return `.${pathMatch[1].toLowerCase()}`;
  return '.bin';
}

async function fetchBinaryFromUrl(rawUrl: string) {
  const candidates = [rawUrl];
  const driveCandidate = buildDriveDownloadUrl(rawUrl);
  if (driveCandidate && driveCandidate !== rawUrl) candidates.unshift(driveCandidate);

  let lastError = 'No se pudo descargar el archivo';

  for (const url of candidates) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const contentType = res.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        lastError = 'La URL devolvió HTML en lugar de un archivo descargable';
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        lastError = 'Archivo vacío';
        continue;
      }

      return {
        ok: true as const,
        contentType,
        buffer: Buffer.from(arrayBuffer),
        sourceUrl: url,
      };
    } catch (error: any) {
      lastError = error?.message || 'Error desconocido descargando archivo';
    }
  }

  return {
    ok: false as const,
    error: lastError,
  };
}

type DocRecord = {
  id: number;
  archivo_url: string | null;
  fecha?: string | null;
  numero?: string | null;
  cliente?: string | null;
  nombre_proveedor?: string | null;
  empleado?: string | null;
  concepto?: string | null;
  tipo?: string | null;
  periodo?: string | null;
};

async function addDocumentsToZip(opts: {
  zip: JSZip;
  folderName: string;
  docs: DocRecord[];
  buildBaseName: (doc: DocRecord) => string;
  manifestLines: string[];
}) {
  const folder = opts.zip.folder(opts.folderName);
  if (!folder) return;

  for (const doc of opts.docs) {
    const label = `${opts.folderName}#${doc.id}`;

    if (!doc.archivo_url) {
      opts.manifestLines.push(`[PENDIENTE] ${label} -> sin archivo_url`);
      continue;
    }

    const result = await fetchBinaryFromUrl(doc.archivo_url);
    if (!result.ok) {
      opts.manifestLines.push(`[ERROR] ${label} -> ${result.error} -> ${doc.archivo_url}`);
      continue;
    }

    const extension = inferExtension(result.contentType, doc.archivo_url);
    const fileName = `${opts.buildBaseName(doc)}${extension}`;
    folder.file(fileName, result.buffer);
    opts.manifestLines.push(`[OK] ${label} -> ${opts.folderName}/${fileName}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = getCurrentQuarter(now);

    const year = parseYear(request.nextUrl.searchParams.get('year'), currentYear);
    const quarter = parseQuarter(request.nextUrl.searchParams.get('quarter'), currentQuarter);
    const range = getQuarterRange(year, quarter);

    const [facturasRes, emitidasRes, impuestosRes, nominasRes] = await Promise.all([
      supabase
        .from('facturas')
        .select('id, fecha, numero, cliente, nombre_proveedor, archivo_url')
        .gte('fecha', range.from)
        .lte('fecha', range.to)
        .not('archivo_url', 'is', null)
        .order('fecha', { ascending: true }),
      supabase
        .from('facturas_emitidas')
        .select('id, fecha, numero, cliente, archivo_url')
        .gte('fecha', range.from)
        .lte('fecha', range.to)
        .not('archivo_url', 'is', null)
        .order('fecha', { ascending: true }),
      supabase
        .from('impuestos')
        .select('id, concepto, tipo, periodo, fecha_pago, archivo_url')
        .eq('trimestre_fiscal', range.label)
        .not('archivo_url', 'is', null)
        .order('fecha_pago', { ascending: true }),
      supabase
        .from('nominas')
        .select('id, empleado, periodo, fecha_pago, archivo_url')
        .eq('trimestre_fiscal', range.label)
        .not('archivo_url', 'is', null)
        .order('fecha_pago', { ascending: true }),
    ]);

    const facturas = (facturasRes.data || []) as DocRecord[];
    const emitidas = (emitidasRes.data || []) as DocRecord[];
    const impuestos = (impuestosRes.data || []) as DocRecord[];
    const nominas = (nominasRes.data || []) as DocRecord[];

    const zip = new JSZip();
    const manifestLines: string[] = [
      `ZIP documental del trimestre ${range.label}`,
      `Generado: ${new Date().toISOString()}`,
      '',
      `Facturas recibidas con archivo: ${facturas.length}`,
      `Facturas emitidas con archivo: ${emitidas.length}`,
      `Impuestos con archivo: ${impuestos.length}`,
      `Nóminas con archivo: ${nominas.length}`,
      '',
      'Detalle de incorporación al ZIP:',
    ];

    await addDocumentsToZip({
      zip,
      folderName: '01_Facturas_Recibidas',
      docs: facturas,
      buildBaseName: (doc) => [doc.fecha, doc.numero, doc.nombre_proveedor || doc.cliente, doc.id]
        .map((v) => sanitizePart(v))
        .join('_'),
      manifestLines,
    });

    await addDocumentsToZip({
      zip,
      folderName: '02_Facturas_Emitidas',
      docs: emitidas,
      buildBaseName: (doc) => [doc.fecha, doc.numero, doc.cliente, doc.id]
        .map((v) => sanitizePart(v))
        .join('_'),
      manifestLines,
    });

    await addDocumentsToZip({
      zip,
      folderName: '03_Impuestos',
      docs: impuestos,
      buildBaseName: (doc) => [doc.periodo, doc.tipo || doc.concepto, doc.id]
        .map((v) => sanitizePart(v))
        .join('_'),
      manifestLines,
    });

    await addDocumentsToZip({
      zip,
      folderName: '04_Nominas',
      docs: nominas,
      buildBaseName: (doc) => [doc.periodo, doc.empleado, doc.id]
        .map((v) => sanitizePart(v))
        .join('_'),
      manifestLines,
    });

    zip.file('MANIFIESTO.txt', manifestLines.join('\n'));

    const zipBytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const fileName = `cierre-documental-${range.label}.zip`;

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error generando ZIP documental:', error);
    return NextResponse.json(
      { error: 'No se pudo generar el ZIP documental', details: error?.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}
