import { useState, useRef } from 'react';
import { X, UploadCloud, AlertCircle, FileSpreadsheet, Check } from 'lucide-react';
import { bulkInsertMovimientos } from '@/app/movimientos/actions';
import * as XLSX from 'xlsx';

export function ImportadorCSVModal({ onComplete, onCancel }: { onComplete: (msg: string) => void, onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = async (f: File) => {
    try {
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      let headerIdx = -1;
      for (let i = 0; i < Math.min(30, json.length); i++) {
        const rowStr = (json[i] || []).map(c => String(c).toLowerCase()).join(' ');
        if (rowStr.includes('concepto') && rowStr.includes('importe') && (rowStr.includes('f. contable') || rowStr.includes('fecha'))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        throw new Error("No se encontraron las columnas 'CONCEPTO' e 'IMPORTE' en el archivo Excel/CSV.");
      }

      const headers = (json[headerIdx] || []).map((h: any) => String(h || '').trim().toLowerCase());
      const colFechas = ["f. contable", "fecha"];
      const colFecha = headers.findIndex(h => colFechas.includes(h));
      const colConcepto = headers.findIndex(h => h === "concepto");
      const colBenef = headers.findIndex(h => h.includes("beneficiario") || h.includes("ordenante"));
      const colObs = headers.findIndex(h => h.includes("observaciones") || h === "observación");
      const colImporte = headers.findIndex(h => h === "importe" || h === "movimiento");
      
      const colFValor = headers.findIndex(h => h === "f. valor" || h === "fecha valor");
      const colCodigo = headers.findIndex(h => h === "código" || h === "codigo");
      const colSaldo = headers.findIndex(h => h === "saldo");
      const colDivisa = headers.findIndex(h => h === "divisa");
      const colOficina = headers.findIndex(h => h === "oficina");
      const colRemesa = headers.findIndex(h => h === "remesa");

      if (colFecha === -1 || colConcepto === -1 || colImporte === -1) {
        throw new Error("Faltan columnas requeridas (F. Contable, Concepto e Importe) en el archivo del BBVA.");
      }

      const parseFecha = (val: any) => {
        if (!val) return null;
        if (typeof val === 'number' && val > 25000) {
          const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
          return jsDate.toISOString().split('T')[0];
        }
        let s = String(val).trim();
        let fDb = s;
        if (s.includes('/')) {
          const p = s.split('/');
          if (p.length >= 3) {
            if (p[2].length === 4) fDb = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            else if (p[0].length === 4) fDb = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
          }
        } else if (s.includes('-')) {
           const p = s.split('-');
           if (p.length >= 3 && p[2].length === 4) fDb = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fDb)) {
           const d = new Date(s);
           if (!isNaN(d.getTime())) fDb = d.toISOString().split('T')[0];
        }
        return fDb;
      };

      const parseMoneda = (val: any) => {
        if (typeof val === 'number') return val;
        let s = String(val).replace(/[^\d.,-]/g, '');
        if (s.includes(',') && s.indexOf('.') < s.indexOf(',')) s = s.replace(/\./g, '').replace(',', '.');
        else if (s.includes(',')) s = s.replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? null : num;
      };

      const rawData = [];
      for (let i = headerIdx + 1; i < json.length; i++) {
        const row = json[i];
        if (!row || row.length < 3) continue;

        const fDateVal = row[colFecha];
        const fImporteVal = row[colImporte];
        if (!fDateVal || !fImporteVal) continue;

        const importeNumber = parseMoneda(fImporteVal);
        if (importeNumber === null) continue;

        const baseConcepto = row[colConcepto] ? String(row[colConcepto]).trim() : '';
        const benef = colBenef !== -1 && row[colBenef] ? String(row[colBenef]).trim() : '';
        const obs = colObs !== -1 && row[colObs] ? String(row[colObs]).trim() : '';
        const codigo = colCodigo !== -1 && row[colCodigo] ? String(row[colCodigo]).trim() : '';
        const divisa = colDivisa !== -1 && row[colDivisa] ? String(row[colDivisa]).trim() : '';
        const oficina = colOficina !== -1 && row[colOficina] ? String(row[colOficina]).trim() : '';
        const remesa = colRemesa !== -1 && row[colRemesa] ? String(row[colRemesa]).trim() : '';
        
        let saldoNumber = null;
        if (colSaldo !== -1 && row[colSaldo]) saldoNumber = parseMoneda(row[colSaldo]);

        const fechaDb = parseFecha(fDateVal) || String(fDateVal);
        const fValorDb = colFValor !== -1 ? parseFecha(row[colFValor]) : null;

        rawData.push({
          banco: 'BBVA',
          fecha: fechaDb,
          f_valor: fValorDb || null,
          codigo: codigo || null,
          concepto: baseConcepto || "Movimiento Bancario",
          beneficiario: benef || null,
          observaciones: obs || null,
          importe: importeNumber,
          saldo: saldoNumber,
          divisa: divisa || null,
          oficina: oficina || null,
          remesa: remesa || null,
          tipo: importeNumber >= 0 ? 'Cobro' : 'Pago',
          estado_conciliacion: 'Pendiente',
          _idUnico: i
        });
      }

      if (rawData.length === 0) throw new Error("No se pudo extraer ninguna fila válida de datos.");
      
      setPreview(rawData);
      setFile(f);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error procesando el archivo CSV.');
      setFile(null);
      setPreview([]);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const handleUpload = async () => {
    if (!preview.length) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { inserted, duplicates } = await bulkInsertMovimientos(preview);
      onComplete(`Excel importado con éxito: ${inserted} nuevos, ${duplicates} ignorados por duplicidad.`);
    } catch (e: any) {
      setError(e.message || "Error al subir a la base de datos.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" /> 
            Subir Excel (BBVA)
          </h2>
          <button onClick={onCancel} disabled={isSubmitting} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {!file && (
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-colors group"
            >
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sube tu Excel o CSV</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">Arrastra el Excel que descargas del BBVA aquí o haz clic para seleccionarlo. Formatos soportados: .xlsx, .xls, .csv</p>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Error de lectura</p>
                <p>{error}</p>
                {file && (
                  <button onClick={() => { setFile(null); setError(null); }} className="mt-2 text-xs underline font-semibold">Probar con otro archivo</button>
                )}
              </div>
            </div>
          )}

          {preview.length > 0 && !error && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Previsualización (Top 5)</h3>
                <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 font-medium rounded-full">
                  {preview.length} movimientos detectados
                </span>
              </div>
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs whitespace-nowrap hidden sm:table">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-500">Fecha</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Cód.</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Concepto</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Beneficiario / Obs.</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-right">Importe</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-black">
                    {preview.slice(0, 5).map(m => (
                      <tr key={m._idUnico}>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{m.fecha}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-500">{m.codigo || '-'}</td>
                        <td className="px-4 py-2 text-gray-900 dark:text-white truncate max-w-[150px]">{m.concepto}</td>
                        <td className="px-4 py-2 text-gray-500 truncate max-w-[200px]">
                          {m.beneficiario ? <span className="mr-2 font-semibold">{m.beneficiario}</span> : null}
                          {m.observaciones || '-'}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${m.importe > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                          {m.importe > 0 ? '+' : ''}{m.importe}€
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400 font-mono text-xs">{m.saldo ? `${m.saldo}€` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 5 && (
                  <div className="text-center py-2 text-xs text-gray-400 bg-gray-50/50 dark:bg-white/5">
                    Y {preview.length - 5} movimientos más...
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">💡 No te preocupes por los duplicados. El sistema descartará los que ya se subieron anteriormente de forma automática.</p>
            </div>
          )}
        </div>

        {preview.length > 0 && !error && (
          <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex justify-end gap-3 shrink-0">
            <button 
              disabled={isSubmitting}
              onClick={() => { setFile(null); setPreview([]); }} 
              className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={isSubmitting}
              onClick={handleUpload}
              className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Importando...' : <><Check className="w-4 h-4" /> Importar {preview.length} Movimientos</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
