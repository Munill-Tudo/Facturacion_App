'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileItem {
  file: File;
  id: string;
  status: FileStatus;
  message: string;
  proveedor?: string;
}

export function UploadInvoiceModal({
  onClose,
  onSuccess,
  initialFile = null,
}: {
  onClose: () => void;
  onSuccess: () => void;
  initialFile?: File | null;
}) {
  const [items, setItems] = useState<FileItem[]>(() =>
    initialFile
      ? [{ file: initialFile, id: crypto.randomUUID(), status: 'pending', message: '' }]
      : []
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfs.length) return;
    setItems(prev => [
      ...prev,
      ...pdfs.map(f => ({ file: f, id: crypto.randomUUID(), status: 'pending' as FileStatus, message: '' }))
    ]);
    setAllDone(false);
  }, []);

  const updateItem = (id: string, patch: Partial<FileItem>) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  const processAll = useCallback(async (fileItems: FileItem[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsRunning(true);

    const pending = fileItems.filter(it => it.status === 'pending');
    for (const item of pending) {
      updateItem(item.id, { status: 'uploading', message: 'Procesando con IA…' });
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        const res = await fetch('/api/facturas/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        updateItem(item.id, {
          status: 'done',
          message: 'Guardada correctamente',
          proveedor: data.factura?.cliente || 'Proveedor',
        });
      } catch (err: any) {
        updateItem(item.id, { status: 'error', message: err.message || 'Error de conexión' });
      }
    }

    processingRef.current = false;
    setIsRunning(false);
    setAllDone(true);
    onSuccess();
  }, [onSuccess]);

  // Auto-start if pre-loaded file from drag-drop
  useEffect(() => {
    if (initialFile && items.length > 0) {
      processAll(items);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const statusIcon = (s: FileStatus) => {
    if (s === 'uploading') return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />;
    if (s === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (s === 'error') return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
    return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
  };

  const statusColor = (s: FileStatus) => {
    if (s === 'uploading') return 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30';
    if (s === 'done') return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
    if (s === 'error') return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30';
    return 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-gray-800';
  };

  const doneCount = items.filter(it => it.status === 'done').length;
  const errorCount = items.filter(it => it.status === 'error').length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            Subir Facturas
            {items.length > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                ({doneCount}/{items.length} procesadas)
              </span>
            )}
          </h2>
          <button onClick={onClose} disabled={isRunning}
            className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors disabled:opacity-30">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        {!allDone && (
          <div className="p-5 shrink-0">
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isRunning && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer select-none ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01]'
                  : 'border-gray-300 dark:border-gray-700 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-white/5'
              } ${isRunning ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <UploadCloud className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {isDragging ? '¡Suelta para añadir!' : 'Arrastra varios PDFs aquí'}
              </p>
              <p className="text-xs text-gray-500 mt-1">O haz clic para seleccionar uno o varios archivos</p>
            </div>
          </div>
        )}

        {/* File list with progress */}
        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-2">
            {items.map(item => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${statusColor(item.status)}`}>
                {statusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.file.name}</p>
                  {item.message && (
                    <p className={`text-xs mt-0.5 ${
                      item.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' :
                      item.status === 'error' ? 'text-red-500' : 'text-indigo-500'
                    }`}>
                      {item.status === 'done' && item.proveedor ? `${item.proveedor} · ` : ''}{item.message}
                    </p>
                  )}
                </div>
                {item.status === 'pending' && !isRunning && (
                  <button onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary after all done */}
        {allDone && (
          <div className="px-5 py-4 shrink-0">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                  {doneCount} factura{doneCount !== 1 ? 's' : ''} procesada{doneCount !== 1 ? 's' : ''} correctamente
                </p>
                {errorCount > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">{errorCount} error{errorCount !== 1 ? 'es' : ''} — revisa los archivos marcados en rojo</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-between gap-3 bg-gray-50/50 dark:bg-white/5 shrink-0">
          {allDone ? (
            <>
              {errorCount > 0 && (
                <button onClick={() => { setAllDone(false); setItems(prev => prev.filter(it => it.status !== 'done')); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                  <RefreshCw className="w-4 h-4" /> Reintentar errores
                </button>
              )}
              <button onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20 transition-all ml-auto">
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} disabled={isRunning}
                className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={() => processAll(items)}
                disabled={isRunning || items.filter(it => it.status === 'pending').length === 0}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:shadow-none">
                {isRunning
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando…</>
                  : <><UploadCloud className="w-4 h-4" />Subir {items.filter(it => it.status === 'pending').length} factura{items.filter(it => it.status === 'pending').length !== 1 ? 's' : ''}</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
