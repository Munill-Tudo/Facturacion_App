'use client';

import { useState, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import { UploadEmitidaModal } from './UploadEmitidaModal';
import { useRouter } from 'next/navigation';

export function UploadEmitidaButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      const hasPDF = Array.from(e.dataTransfer?.items || []).some(
        i => i.kind === 'file' && i.type === 'application/pdf'
      );
      if (hasPDF) setDragOver(true);
    };
    const leave = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file?.type === 'application/pdf') {
        setDroppedFile(file);
        setIsOpen(true);
      }
    };

    document.addEventListener('dragover', over);
    document.addEventListener('dragleave', leave);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('drop', drop);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setDroppedFile(null);
  };

  const handleSuccess = () => {
    setIsOpen(false);
    setDroppedFile(null);
    router.refresh();
  };

  return (
    <>
      {dragOver && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="absolute inset-4 rounded-3xl border-4 border-dashed border-emerald-500 bg-emerald-600/15 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-emerald-600 text-white px-8 py-5 rounded-2xl font-bold text-xl shadow-2xl shadow-emerald-600/40 flex items-center gap-3 animate-bounce">
               <UploadCloud className="w-8 h-8" />
              Suelta el PDF para procesar la factura emitida
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 font-bold transition-all"
      >
        <UploadCloud className="w-5 h-5" />
        Subir Factura
      </button>

      {isOpen && (
        <UploadEmitidaModal
          initialFile={droppedFile}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
