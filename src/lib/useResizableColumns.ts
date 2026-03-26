'use client';
import { useState, useRef, useCallback } from 'react';

/**
 * Resizable columns hook with localStorage persistence.
 * @param storageKey - unique key per table (e.g. 'cols_facturas')
 * @param initialWidths - default column widths in px
 */
export function useResizableColumns(
  storageKey: string,
  initialWidths: Record<string, number>
) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return initialWidths;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...initialWidths, ...JSON.parse(stored) } : initialWidths;
    } catch {
      return initialWidths;
    }
  });

  const dragRef = useRef<{ startX: number; startW: number; col: string } | null>(null);

  const onMouseDown = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement | null;
    const startW = th ? th.offsetWidth : (initialWidths[col] ?? 120);
    dragRef.current = { startX: e.clientX, startW, col };

    const onMove = (mv: MouseEvent) => {
      if (!dragRef.current) return;
      const newW = Math.max(50, dragRef.current.startW + mv.clientX - dragRef.current.startX);
      setWidths(prev => {
        const next = { ...prev, [dragRef.current!.col]: newW };
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
        return next;
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return { widths, onMouseDown };
}
