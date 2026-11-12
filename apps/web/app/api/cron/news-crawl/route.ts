import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

const timingSafeStringCompare = (expected: string, provided: string): boolean => {
  const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
  const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
  return crypto.timingSafeEqual(expectedDigest, providedDigest);
};

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: CRON_SECRET is not configured',
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-cron-secret');

    const matchesBearer =
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ') &&
      authHeader.length > 'Bearer '.length &&
      timingSafeStringCompare(cronSecret, authHeader.slice('Bearer '.length));

    const matchesCronHeader =
      typeof cronHeader === 'string' &&
      cronHeader.length > 0 &&
      timingSafeStringCompare(cronSecret, cronHeader);

    if (!matchesBearer && !matchesCronHeader) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized cron trigger',
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

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
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json(
      {
        success: res.ok,
        triggeredAt: new Date().toISOString(),
        backendStatus: res.status,
        result: data,
      },
      {
        status: res.status,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error: any) {
    console.error('[Vercel Cron] News crawl trigger error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to trigger crawler on backend',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export const POST = GET;
