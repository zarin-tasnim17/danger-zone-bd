import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const rawTarget =
      process.env.INTERNAL_API_URL ||
      (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.startsWith('/')
        ? process.env.NEXT_PUBLIC_API_URL
        : 'https://danger-zone-bd.onrender.com');

    const targetUrl = rawTarget.replace(/\/+$/, '').replace(/\/api\/v1$/, '');

    console.log(`[Vercel Cron] 🌐 Triggering automated hourly news crawl on ${targetUrl}...`);

    const res = await fetch(`${targetUrl}/api/v1/cron/news-crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { 'x-cron-secret': process.env.CRON_SECRET } : {}),
      },
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json({
      success: true,
      triggeredAt: new Date().toISOString(),
      backendStatus: res.status,
      result: data,
    });
  } catch (error: any) {
    console.error('[Vercel Cron] News crawl trigger error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to trigger crawler on backend',
      },
      { status: 500 }
    );
  }
}
