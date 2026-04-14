import { NextRequest, NextResponse } from 'next/server';
import { syncMovimientoIncidencias } from '@/lib/operativa';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const movimientoId = body?.movimientoId;

    if (!movimientoId) {
      return NextResponse.json({ ok: false, error: 'movimientoId es obligatorio' }, { status: 400 });
    }

    const result = await syncMovimientoIncidencias(movimientoId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'No se pudo sincronizar el movimiento' },
      { status: 500 }
    );
  }
}
