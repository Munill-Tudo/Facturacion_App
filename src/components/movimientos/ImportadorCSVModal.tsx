import { useState, useRef } from 'react';
import { X, UploadCloud, AlertCircle, FileSpreadsheet, Check } from 'lucide-react';
import { bulkInsertMovimientos } from '@/app/movimientos/actions';

export function ImportadorCSVModal({ onComplete, onCancel }: { onComplete: (msg: string) => void, onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = async (f: File) => {
    try {
      const text = await f.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      
      // Intentar detectar delimitador (, o ;)
      const firstLine = lines[0] || '';
      const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ',';

      // Encontrar fila de cabeceras (contiene Fecha, Concepto o Importe)
      let headerIdx = -1;
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const l = lines[i].toLowerCase();
        if (l.includes('fecha') && (l.includes('concepto') || l.includes('importe') || l.includes('movimiento'))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        throw new Error("No se encontraron las columnas 'Fecha', 'Concepto' e 'Importe' en el archivo.");
      }

      const headers = lines[headerIdx].split(delimiter).map(h => h.replace(/["']/g, '').trim().toLowerCase());
      const colFecha = headers.findIndex(h => h.includes('fecha') && !h.includes('valor'));
      const colConcepto = headers.findIndex(h => h.includes('concepto'));
      const colImporte = headers.findIndex(h => h.includes('importe') || h.includes('movimiento'));

      if (colFecha === -1 || colConcepto === -1 || colImporte === -1) {
        throw new Error("Faltan columnas requeridas. Necesito Fecha, Concepto e Importe/Movimiento.");
      }

      const rawData = [];
      // Parsear datos
      for (let i = headerIdx + 1; i < lines.length; i++) {
        // Ignorar líneas vacías o extrañas
        if (!lines[i] || lines[i].split(delimiter).length < 3) continue;
        
        // Regex para hacer split respetando comillas
        const row = lines[i].split(new RegExp(`\\s*${delimiter}\\s*(?=(?:(?:[^"]*"){2})*[^"]*$)`))
                            .map(c => c.replace(/^"|"$/g, '').trim());
                            
        const fDateStr = row[colFecha];
        const fConcepto = row[colConcepto];
        let fImporteStr = row[colImporte];

        if (!fDateStr || !fConcepto || !fImporteStr) continue;

        // Limpiar importe español: "1.234,56" -> 1234.56
        fImporteStr = fImporteStr.replace(/[^\d.,-]/g, ''); // quitar euros o espacios
        if (fImporteStr.includes(',') && fImporteStr.indexOf('.') < fImporteStr.indexOf(',')) {
          // caso 1.000,50 -> quitar puntos y cambiar coma por punto
          fImporteStr = fImporteStr.replace(/\./g, '').replace(',', '.');
        } else if (fImporteStr.includes(',')) {
          fImporteStr = fImporteStr.replace(',', '.');
        }
        const importeNumber = parseFloat(fImporteStr);
        if (isNaN(importeNumber)) continue;

        // Parsear fecha DD/MM/YYYY a YYYY-MM-DD
        let fechaDb = fDateStr;
        if (fDateStr.includes('/')) {
          const parts = fDateStr.split('/');
          if (parts.length === 3) {
            // DD/MM/YYYY
            if (parts[2].length === 4) fechaDb = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            // YYYY/MM/DD
            else if (parts[0].length === 4) fechaDb = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        } else if (fDateStr.includes('-')) {
          const parts = fDateStr.split('-');
          if (parts[2].length === 4) fechaDb = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        // Si fechaDb no es válida (ej YYYY-MM-DD), intentar parse
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDb)) {
          const dObj = new Date(fDateStr);
          if (!isNaN(dObj.getTime())) {
            fechaDb = dObj.toISOString().split('T')[0];
          }
        }

        rawData.push({
          banco: 'BBVA',
          fecha: fechaDb,
          concepto: fConcepto,
          importe: importeNumber,
          tipo: importeNumber >= 0 ? 'Cobro' : 'Pago',
          estado_conciliacion: 'Pendiente',
          // para la visualizacion
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
    if (f) parseCSV(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseCSV(f);
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
            Importador de Banco (CSV)
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
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">Arrastra el documento descargado del BBVA aquí o haz clic para seleccionarlo de tu ordenador. Formatos soportados: .csv</p>
              <input type="file" accept=".csv,.txt" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
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
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-500">Fecha</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Concepto</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-black">
                    {preview.slice(0, 5).map(m => (
                      <tr key={m._idUnico}>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{m.fecha}</td>
                        <td className="px-4 py-2 text-gray-900 dark:text-white truncate max-w-[250px]">{m.concepto}</td>
                        <td className={`px-4 py-2 text-right font-medium ${m.importe > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                          {m.importe > 0 ? '+' : ''}{m.importe}€
                        </td>
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
