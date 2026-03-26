'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Resizable columns hook with localStorage persistence.
 * localStorage is loaded AFTER hydration (in useEffect) to prevent SSR mismatch.
 */
export function useResizableColumns(
  storageKey: string,
  initialWidths: Record<string, number>
) {
  // Always start with initialWidths (both server and client) — avoids hydration mismatch
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths);

  // After mount, restore saved widths from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setWidths(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, [storageKey]);

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
