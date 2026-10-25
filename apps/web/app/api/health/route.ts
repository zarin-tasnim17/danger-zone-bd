import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://danger-zone-bd.onrender.com';
  const startTime = Date.now();

  let backendStatus = 'unknown';
  let dbStatus = 'unknown';
  let backendLatency = 0;
  let dbLatency = 0;

  try {
    const t0 = Date.now();
    const res = await fetch(`${backendUrl}/health`, { cache: 'no-store' });
    backendLatency = Date.now() - t0;
    if (res.ok) {
      backendStatus = 'online';
    } else {
      backendStatus = `error-${res.status}`;
    }
  } catch (err: any) {
    backendStatus = `unreachable: ${err.message || 'connection failed'}`;
  }

  try {
    const t0 = Date.now();
    const res = await fetch(`${backendUrl}/health/db`, { cache: 'no-store' });
    dbLatency = Date.now() - t0;
    if (res.ok) {
      dbStatus = 'connected';
    } else {
      dbStatus = `error-${res.status}`;
    }
  } catch (err: any) {
    dbStatus = `unreachable: ${err.message || 'connection failed'}`;
  }

  const allHealthy = backendStatus === 'online' && dbStatus === 'connected';

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - startTime,
      services: {
        frontend: {
          name: 'Next.js Frontend (Vercel)',
          status: 'online',
          mode: process.env.NODE_ENV || 'production',
        },
        backend: {
          name: 'Express API (Render)',
          url: backendUrl,
          status: backendStatus,
          latencyMs: backendLatency,
        },
        database: {
          name: 'Supabase PostgreSQL + PostGIS',
          status: dbStatus,
          latencyMs: dbLatency,
          query: 'SELECT 1 (via Prisma ORM)',
        },
      },
    },
    {
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
