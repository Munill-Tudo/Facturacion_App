'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    // Fetch newly created invoices (Last 10)
    const { data: facturas } = await supabase
      .from('facturas')
      .select('id, nombre_proveedor, cliente, importe, created_at, estado')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!facturas) return;

    const notifs: any[] = [];
    
    // Generar notificaciones ficticias basadas en la fecha de creación y estado
    facturas.forEach(f => {
      // 1. Notificación de nueva factura (siempre)
      const isNew = new Date(f.created_at).getTime() > Date.now() - 3 * 24 * 60 * 60 * 1000; // Últimos 3 días
      if (isNew) {
        notifs.push({
          id: `new-${f.id}`,
          type: 'new_invoice',
          title: 'Nueva factura recibida',
          desc: `De ${f.nombre_proveedor || f.cliente || 'Desconocido'} por ${Number(f.importe || 0).toLocaleString('es-ES')}€`,
          time: new Date(f.created_at),
          invoiceId: f.id,
          read: false
        });
      }

      // 2. Notificación de cobro/pago (si está pagada/abonada)
      if (f.estado === 'Pagada' || f.estado === 'Abonado') {
        notifs.push({
          id: `pay-${f.id}`,
          type: 'payment',
          title: 'Cobro registrado',
          desc: `La factura de ${f.nombre_proveedor || f.cliente || 'Desconocido'} ha sido marcada como Pagada.`,
          time: new Date(f.created_at), // Proxy, en un sistema real sería la fecha de actualización
          invoiceId: f.id,
          read: !isNew // Si es antigua, ya la damos por leída
        });
      }
    });

    // Sort by time descending
    notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
    
    // Check for NEW notifications to trigger OS notification
    const newItems = notifs.filter(n => !prevIdsRef.current.has(n.id));
    if (newItems.length > 0 && prevIdsRef.current.size > 0) {
      newItems.forEach(n => {
        if (Notification.permission === 'granted') {
          new Notification(n.title, { body: n.desc, icon: '/favicon.ico' });
        }
      });
    }
    prevIdsRef.current = new Set(notifs.map(n => n.id));

    setNotifications(notifs.slice(0, 10)); // Mostrar las últimas 10
    setUnreadCount(notifs.filter(n => !n.read).length);
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchNotifications();
    // Simular un polling cada 1 minuto
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      // Marcar todas como leídas visualmente
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const getTimeAgo = (date: Date) => {
    const minAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minAgo < 60) return `${minAgo || 1} min`;
    const hoursAgo = Math.floor(minAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h`;
    return `${Math.floor(hoursAgo / 24)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black"></span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#111] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notificaciones</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full dark:bg-red-500/10 dark:text-red-400">
                {unreadCount} nuevas
              </span>
            )}
          </div>
          
          <div className="max-h-[350px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No hay notificaciones recientes.
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {notifications.map((n) => (
                  <div key={n.id} onClick={() => { setOpen(false); router.push(`/facturas/${n.invoiceId}`); }}
                    className={`p-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${!n.read ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}>
                    <div className="mt-0.5 shrink-0">
                      {n.type === 'new_invoice' ? (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.desc}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 font-medium">{getTimeAgo(n.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5">
            <button onClick={() => { setOpen(false); router.push('/facturas'); }} className="w-full text-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center justify-center gap-1">
              Ver todas las facturas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
