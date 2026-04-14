import { NextResponse } from 'next/server';
import { syncIncidenciasBasicas } from '@/lib/operativa';

export async function POST() {
  try {
    await syncIncidenciasBasicas();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'No se pudo sincronizar la bandeja operativa' },
      { status: 500 }
    );
  }
}
