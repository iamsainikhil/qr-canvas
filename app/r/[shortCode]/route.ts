import { NextRequest, NextResponse } from 'next/server';

/**
 * Backward-compatibility redirect for legacy /r/[shortCode] URLs.
 * All existing QR codes and short links point here; we redirect to /api/r/
 * to consolidate routing while preserving analytics and scan tracking.
 * Using 301 permanent redirect for SEO and cache efficiency.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  const shortCode = (params.shortCode || '').trim();
  if (!shortCode) {
    return NextResponse.redirect(new URL('/scan-error?reason=invalid', request.url), {
      status: 301,
    });
  }

  // Preserve all query params (utm_*, etc.) through redirect
  const query = request.nextUrl.search;
  const redirectUrl = new URL(`/api/r/${shortCode}${query}`, request.url);
  
  return NextResponse.redirect(redirectUrl, { status: 301 });
}
