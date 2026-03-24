'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { UploadInvoiceModal } from './UploadInvoiceModal';
import { useRouter } from 'next/navigation';

export function UploadInvoiceButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 font-bold transition-all"
      >
        <UploadCloud className="w-5 h-5" />
        Subir Factura
      </button>

      {isOpen && (
        <UploadInvoiceModal 
          onClose={() => setIsOpen(false)} 
          onSuccess={handleSuccess} 
        />
      )}
    </>
  );
}
