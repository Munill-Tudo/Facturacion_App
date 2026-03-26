import { useState, useRef, useEffect, useCallback } from 'react';
import { X, UploadCloud, FileType2, Loader2, CheckCircle2 } from 'lucide-react';

export function UploadInvoiceModal({ 
  onClose, 
  onSuccess,
  initialFile = null,
}: { 
  onClose: () => void, 
  onSuccess: () => void,
  initialFile?: File | null,
}) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (fileToProcess: File) => {
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', fileToProcess);
    try {
      const res = await fetch('/api/facturas/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details ? ` (${data.details})` : '';
        throw new Error((data.error || 'Error procesando la factura.') + detail);
      }
      setSuccessMsg(`Factura de ${data.factura?.cliente || 'Proveedor'} guardada correctamente. Recargando...`);
      setTimeout(() => onSuccess(), 2000);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
      setIsUploading(false);
    }
  }, [onSuccess]);

  // If a file was pre-loaded (drag-drop from page), auto-process it
  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setError(null);
    } else {
      setError('Por favor, selecciona un archivo PDF válido.');
    }
  };

  const handleUpload = () => { if (file) processFile(file); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            Subir Factura Manual
          </h2>
          <button onClick={onClose} disabled={isUploading} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 animate-in slide-in-from-top-2">{error}</div>
          )}
          {successMsg && (
            <div className="mb-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200 flex items-center gap-2 font-medium animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />{successMsg}
            </div>
          )}

          {/* Auto-processing state: show loader when file came from drag-drop */}
          {!successMsg && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                file
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                  : 'border-gray-300 dark:border-gray-700 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-white/5'
              } ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" />
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">Procesando con IA…</p>
                  <p className="text-sm text-gray-500">{file?.name}</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <FileType2 className="w-8 h-8" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px] mx-auto">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full flex items-center justify-center mb-2">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">Arrastra tu factura en PDF aquí</p>
                  <p className="text-sm text-gray-500">O haz clic para seleccionar un archivo</p>
                </div>
              )}
            </div>
          )}
        </div>

        {!successMsg && !initialFile && (
          <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-white/5">
            <button type="button" onClick={onClose} disabled={isUploading}
              className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleUpload} disabled={!file || isUploading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:shadow-none">
              {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando...</> : <><UploadCloud className="w-4 h-4" />Subir y Extraer</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
