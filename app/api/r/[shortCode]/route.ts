import crypto from 'crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebaseAdmin';

const BOT_UA_RE = /bot|crawler|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram\/|curl\/|wget\/|python-requests|go-http-client|java\/|headlesschrome|prerender|lighthouse|pagespeed|googleimageproxy|adsbot/i;

const isBot = (ua: string) => BOT_UA_RE.test(ua);

const normalizeIp = (rawIp: string) => {
  if (!rawIp) return 'unknown';
  if (rawIp.includes(':')) {
    return rawIp.split(':').slice(0, 4).join(':');
  }

  const parts = rawIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  return rawIp;
};

const hashIp = (ip: string) => {
  const salt = process.env.SCAN_IP_HASH_SALT || 'fallback-salt';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
};

const buildErrorRedirect = (request: NextRequest, reason: string) => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/scan-error?reason=${reason}`;
};

const extractUtmParams = (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmTerm: params.get('utm_term') || '',
    utmContent: params.get('utm_content') || '',
  };
};

const redirectWithNoStore = (location: string) => {
  return NextResponse.redirect(location, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } },
) {
  const shortCode = (params.shortCode || '').trim();
  if (!shortCode) {
    return redirectWithNoStore(buildErrorRedirect(request, 'invalid'));
  }

  try {
    const db = getAdminDb();
    const routeRef = db.collection('qr_routes').doc(shortCode);
    const routeDoc = await routeRef.get();

    if (!routeDoc.exists) {
      return redirectWithNoStore(buildErrorRedirect(request, 'not_found'));
    }

    const routeData = routeDoc.data() as {
      ownerUid: string;
      qrId: string;
      targetValue: string;
      active?: boolean;
    };

    if (!routeData.active) {
      return redirectWithNoStore(buildErrorRedirect(request, 'disabled'));
    }

    const userAgent = request.headers.get('user-agent') || '';
    if (isBot(userAgent)) {
      // Skip scan tracking for bots – they don't represent real user engagement
      // and would inflate scan counts with automated crawl traffic.
      return redirectWithNoStore(routeData.targetValue);
    }

    const response = redirectWithNoStore(routeData.targetValue);

    const now = new Date().toISOString();
    const visitorId = request.cookies.get('visitor_id')?.value || crypto.randomUUID();
    if (!request.cookies.get('visitor_id')?.value) {
      response.cookies.set('visitor_id', visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 31536000,
        path: '/',
      });
    }

    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const ipHash = hashIp(normalizeIp(forwardedFor));

    const referrer = request.headers.get('referer') || '';
    const country = request.headers.get('x-vercel-ip-country') || 'unknown';
    const region = request.headers.get('x-vercel-ip-country-region') || 'unknown';
    const city = request.headers.get('x-vercel-ip-city') || 'unknown';
    const utmParams = extractUtmParams(request);

    const scanRef = db
      .collection('users')
      .doc(routeData.ownerUid)
      .collection('qrs')
      .doc(routeData.qrId)
      .collection('scans')
      .doc();

    await scanRef.set({
      id: scanRef.id,
      qrId: routeData.qrId,
      shortCode,
      timestamp: now,
      visitorId,
      ipHash,
      userAgent,
      referrer,
      country,
      region,
      city,
      ...utmParams,
    });

    await db
      .collection('users')
      .doc(routeData.ownerUid)
      .collection('qrs')
      .doc(routeData.qrId)
      .set(
        {
          updatedAt: now,
          stats: {
            scanCount: FieldValue.increment(1),
            lastScannedAt: now,
          },
        },
        { merge: true },
      );

    return response;
  } catch {
    return redirectWithNoStore(buildErrorRedirect(request, 'error'));
  }
}
