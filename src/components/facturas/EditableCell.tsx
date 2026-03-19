'use client';

import { useState, useRef, useTransition } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { updateFacturaField } from '@/app/facturas/actions';

interface EditableCellProps {
  id: number;
  field: string;
  value?: string | null;
  placeholder?: string;
}

export function EditableCell({ id, field, value, placeholder = '—' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value || '');
  const [saved, setSaved] = useState(value || '');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancel = () => {
    setCurrent(saved);
    setEditing(false);
  };

  const save = () => {
    startTransition(async () => {
      await updateFacturaField(id, field, current);
      setSaved(current);
      setEditing(false);
    });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[120px]">
        <input
          ref={inputRef}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKey}
          className="w-full text-sm border border-indigo-400 dark:border-indigo-500 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400/30"
          placeholder={placeholder}
          disabled={isPending}
        />
        <button onClick={save} disabled={isPending} className="p-1 text-emerald-500 hover:text-emerald-600 transition-colors rounded">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={cancel} disabled={isPending} className="p-1 text-red-400 hover:text-red-500 transition-colors rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="group flex items-center gap-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
    >
      <span className={saved ? '' : 'text-gray-400 italic'}>
        {saved || placeholder}
      </span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
    </button>
  );
}
