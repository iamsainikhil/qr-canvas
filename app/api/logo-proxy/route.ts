import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOST = 'www.google.com';
const ALLOWED_PATH = '/s2/favicons';

const buildNoStoreJson = (body: Record<string, string>, status: number) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

export async function GET(request: NextRequest) {
  const rawUrl = (request.nextUrl.searchParams.get('url') || '').trim();
  if (!rawUrl) {
    return buildNoStoreJson({ error: 'Missing url parameter' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return buildNoStoreJson({ error: 'Invalid url parameter' }, 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return buildNoStoreJson({ error: 'Unsupported protocol' }, 400);
  }

  if (parsed.hostname !== ALLOWED_HOST || parsed.pathname !== ALLOWED_PATH) {
    return buildNoStoreJson({ error: 'URL not allowed' }, 403);
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!upstream.ok) {
      return buildNoStoreJson({ error: 'Upstream favicon fetch failed' }, 502);
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return buildNoStoreJson({ error: 'Could not fetch favicon' }, 502);
  }
}