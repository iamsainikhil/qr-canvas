import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  const shortCode = (params.get('shortCode') || '').trim();

  const basePath = request.nextUrl.basePath;

  if (!shortCode) {
    const target = new URL(`${basePath}/scan-error?reason=invalid`, request.nextUrl.origin);
    return NextResponse.redirect(target, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  params.delete('shortCode');
  const query = params.toString();
  const path = `${basePath}/api/r/${encodeURIComponent(shortCode)}`;
  const target = new URL(query ? `${path}?${query}` : path, request.nextUrl.origin);

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
